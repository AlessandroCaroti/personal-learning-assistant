fn main() {
  println!("cargo:rerun-if-env-changed=GOOGLE_DRIVE_DESKTOP_CLIENT_SECRET");
  tauri_build::build()
}
