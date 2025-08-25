document.addEventListener("electronToExtension", (event) => {
  console.log("Content script nhận custom event:", event.detail);

  if (
    window.xpathSelector &&
    typeof window.xpathSelector.handleElectronMessage === "function"
  ) {
    // Đặt flag để biết extension được kích hoạt từ Electron
    window.xpathSelector.isActivatedFromElectron = true;
    window.xpathSelector.handleElectronMessage(event.detail);
  } else {
    console.error(
      "XPathSelector instance not found or handleElectronMessage method missing"
    );
  }
});
