use reqwest::{
    header::{HeaderMap, HeaderName, HeaderValue},
    Method,
};
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Clone, Deserialize, Serialize)]
pub struct ProxyHttpHeader {
    name: String,
    value: String,
}

#[derive(Deserialize)]
pub struct ProxyHttpRequest {
    url: String,
    method: Option<String>,
    headers: Option<Vec<ProxyHttpHeader>>,
    body: Option<Vec<u8>>,
    max_response_bytes: Option<usize>,
    follow_redirects: Option<bool>,
    timeout_ms: Option<u64>,
}

fn request_headers(headers: Option<Vec<ProxyHttpHeader>>) -> HeaderMap {
    let mut mapped = HeaderMap::new();
    for header in headers.unwrap_or_default() {
        let Ok(header_name) = HeaderName::from_bytes(header.name.as_bytes()) else {
            continue;
        };
        let Ok(header_value) = HeaderValue::from_str(&header.value) else {
            continue;
        };
        mapped.insert(header_name, header_value);
    }
    mapped
}

fn request_method(method: Option<String>) -> Result<Method, String> {
    let raw = method.unwrap_or_else(|| "GET".into());
    Method::from_bytes(raw.as_bytes()).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn proxy_http_request(request: ProxyHttpRequest) -> Result<tauri::ipc::Response, String> {
    let parsed = reqwest::Url::parse(&request.url).map_err(|e| e.to_string())?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err("Only HTTP(S) requests are supported".into());
    }

    let redirect_policy = if request.follow_redirects.unwrap_or(true) {
        reqwest::redirect::Policy::limited(5)
    } else {
        reqwest::redirect::Policy::none()
    };
    let mut client_builder = reqwest::Client::builder().redirect(redirect_policy);
    if let Some(timeout_ms) = request.timeout_ms {
        client_builder = client_builder.timeout(Duration::from_millis(timeout_ms));
    }
    let client = client_builder.build().map_err(|e| e.to_string())?;
    let mut builder = client
        .request(request_method(request.method)?, parsed)
        .headers(request_headers(request.headers));
    if let Some(body) = request.body {
        builder = builder.body(body);
    }

    let mut response = builder.send().await.map_err(|e| e.to_string())?;
    let status = response.status().as_u16();
    let url = response.url().to_string();
    let headers: Vec<ProxyHttpHeader> = response
        .headers()
        .iter()
        .filter_map(|(name, value)| {
            Some(ProxyHttpHeader {
                name: name.as_str().to_owned(),
                value: value.to_str().ok()?.to_owned(),
            })
        })
        .collect();
    if let (Some(limit), Some(content_length)) =
        (request.max_response_bytes, response.content_length())
    {
        if content_length > limit as u64 {
            return Err("HTTP response exceeds the configured size limit".into());
        }
    }
    let mut body = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
        if request
            .max_response_bytes
            .is_some_and(|limit| body.len() + chunk.len() > limit)
        {
            return Err("HTTP response exceeds the configured size limit".into());
        }
        body.extend_from_slice(&chunk);
    }

    // Frame as [4-byte LE meta length][JSON meta][raw body] and return raw
    // bytes — a Vec<u8> body would cross IPC as a JSON number array (~4x text
    // and ~8x JS heap per byte), which spikes memory on multi-MB responses.
    let meta = serde_json::json!({
        "status": status,
        "headers": headers,
        "url": url,
    });
    let meta_bytes = serde_json::to_vec(&meta).map_err(|e| e.to_string())?;
    let mut out = Vec::with_capacity(4 + meta_bytes.len() + body.len());
    out.extend_from_slice(&(meta_bytes.len() as u32).to_le_bytes());
    out.extend_from_slice(&meta_bytes);
    out.extend_from_slice(&body);
    Ok(tauri::ipc::Response::new(out))
}
