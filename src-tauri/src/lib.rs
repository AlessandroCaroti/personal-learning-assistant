use std::{
  collections::HashMap,
  io::{Read, Write},
  net::TcpListener,
  process::Command,
  time::Duration,
};

use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GoogleDriveOAuthResult {
  code: String,
  redirect_uri: String,
}

fn percent_encode(value: &str) -> String {
  let mut encoded = String::new();

  for byte in value.bytes() {
    if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b'~') {
      encoded.push(byte as char);
    } else {
      encoded.push_str(&format!("%{byte:02X}"));
    }
  }

  encoded
}

fn percent_decode(value: &str) -> Result<String, String> {
  let mut bytes = Vec::new();
  let mut index = 0;
  let raw = value.as_bytes();

  while index < raw.len() {
    match raw[index] {
      b'+' => {
        bytes.push(b' ');
        index += 1;
      }
      b'%' if index + 2 < raw.len() => {
        let hex = std::str::from_utf8(&raw[index + 1..index + 3]).map_err(|error| error.to_string())?;
        let byte = u8::from_str_radix(hex, 16).map_err(|error| error.to_string())?;
        bytes.push(byte);
        index += 3;
      }
      byte => {
        bytes.push(byte);
        index += 1;
      }
    }
  }

  String::from_utf8(bytes).map_err(|error| error.to_string())
}

fn parse_query(request: &str) -> Result<HashMap<String, String>, String> {
  let first_line = request.lines().next().ok_or("Richiesta OAuth non valida")?;
  let path = first_line
    .split_whitespace()
    .nth(1)
    .ok_or("Percorso OAuth non valido")?;
  let query = path.split_once('?').map(|(_, query)| query).unwrap_or("");
  let mut params = HashMap::new();

  for pair in query.split('&').filter(|pair| !pair.is_empty()) {
    let (key, value) = pair.split_once('=').unwrap_or((pair, ""));
    params.insert(percent_decode(key)?, percent_decode(value)?);
  }

  Ok(params)
}

#[cfg(target_os = "windows")]
fn open_browser(url: &str) -> Result<(), String> {
  Command::new("rundll32")
    .arg("url.dll,FileProtocolHandler")
    .arg(url)
    .spawn()
    .map(|_| ())
    .map_err(|error| error.to_string())
}

#[cfg(target_os = "macos")]
fn open_browser(url: &str) -> Result<(), String> {
  Command::new("open")
    .arg(url)
    .spawn()
    .map(|_| ())
    .map_err(|error| error.to_string())
}

#[cfg(all(unix, not(target_os = "macos")))]
fn open_browser(url: &str) -> Result<(), String> {
  Command::new("xdg-open")
    .arg(url)
    .spawn()
    .map(|_| ())
    .map_err(|error| error.to_string())
}

#[tauri::command]
async fn start_google_drive_oauth(
  client_id: String,
  scope: String,
  code_challenge: String,
  state: String,
) -> Result<GoogleDriveOAuthResult, String> {
  tauri::async_runtime::spawn_blocking(move || {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|error| error.to_string())?;
    listener
      .set_nonblocking(false)
      .map_err(|error| error.to_string())?;
    let port = listener.local_addr().map_err(|error| error.to_string())?.port();
    let redirect_uri = format!("http://127.0.0.1:{port}/");
    let authorization_url = format!(
      "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope={}&code_challenge={}&code_challenge_method=S256&state={}&access_type=online&prompt=consent",
      percent_encode(&client_id),
      percent_encode(&redirect_uri),
      percent_encode(&scope),
      percent_encode(&code_challenge),
      percent_encode(&state),
    );

    open_browser(&authorization_url)?;
    listener
      .set_ttl(64)
      .map_err(|error| error.to_string())?;

    let (mut stream, _) = listener.accept().map_err(|error| error.to_string())?;
    stream
      .set_read_timeout(Some(Duration::from_secs(10)))
      .map_err(|error| error.to_string())?;
    let mut buffer = [0; 4096];
    let bytes_read = stream.read(&mut buffer).map_err(|error| error.to_string())?;
    let request = String::from_utf8_lossy(&buffer[..bytes_read]);
    let params = parse_query(&request)?;

    let response_body = "<html><body><p>Accesso completato. Puoi chiudere questa finestra.</p></body></html>";
    let response = format!(
      "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\n\r\n{}",
      response_body.len(),
      response_body,
    );
    stream
      .write_all(response.as_bytes())
      .map_err(|error| error.to_string())?;

    if params.get("state") != Some(&state) {
      return Err("Stato OAuth non valido".to_string());
    }

    if let Some(error) = params.get("error") {
      return Err(error.to_string());
    }

    let code = params
      .get("code")
      .ok_or("Codice OAuth non ricevuto")?
      .to_string();

    Ok(GoogleDriveOAuthResult { code, redirect_uri })
  })
  .await
  .map_err(|error| error.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![start_google_drive_oauth])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
