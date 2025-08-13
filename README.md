# MKT Login Extension

Extension Chrome hỗ trợ lưu trữ và tự động điền thông tin đăng nhập cho các trang web.

## Tính năng

- 🔐 Lưu trữ thông tin đăng nhập an toàn
- 🚀 Tự động điền thông tin đăng nhập
- 🌐 Hỗ trợ nhiều trang web
- 💾 Đồng bộ dữ liệu qua Chrome Sync
- 🎨 Giao diện đẹp và dễ sử dụng
- 🔍 Tự động phát hiện form đăng nhập
- 📱 Responsive design

## Cài đặt

### Cách 1: Cài đặt từ Chrome Web Store (Khuyến nghị)
*Hiện tại extension chưa được publish lên Chrome Web Store*

### Cách 2: Cài đặt thủ công (Developer Mode)

1. Mở Chrome và truy cập `chrome://extensions/`
2. Bật "Developer mode" ở góc trên bên phải
3. Click "Load unpacked" và chọn thư mục chứa extension này
4. Extension sẽ được cài đặt và hiển thị trong thanh công cụ

## Cách sử dụng

### Lưu thông tin đăng nhập

1. Click vào icon extension trên thanh công cụ
2. Nhập thông tin:
   - Tên đăng nhập
   - Mật khẩu
   - Website (tự động điền URL hiện tại)
3. Click "Lưu thông tin"

### Tự động điền thông tin

1. Truy cập trang web có thông tin đã lưu
2. Click vào icon extension
3. Click "Tự động điền" hoặc chọn tài khoản từ danh sách
4. Thông tin sẽ được điền tự động vào form đăng nhập

### Quản lý tài khoản đã lưu

- Xem danh sách tài khoản đã lưu trong popup
- Click "Tải" để load thông tin vào form
- Click "Xóa" để xóa tài khoản không cần thiết
- Click "Xóa dữ liệu" để xóa tất cả thông tin đã lưu

## Tính năng nâng cao

### Context Menu
- Click chuột phải trên trang web để truy cập nhanh:
  - "Điền thông tin đăng nhập"
  - "Lưu thông tin đăng nhập"

### Badge Notification
- Icon extension sẽ hiển thị số "1" khi phát hiện trang có thông tin đã lưu

### Tự động phát hiện
- Extension tự động phát hiện form đăng nhập trên trang
- Hỗ trợ nhiều loại selector khác nhau

## Bảo mật

- Dữ liệu được lưu trữ local và đồng bộ qua Chrome Sync
- Không gửi thông tin đến server bên ngoài
- Mã hóa dữ liệu khi lưu trữ
- Chỉ hoạt động trên các trang được phép

## Cấu trúc dự án

```
MKTLoginExt/
├── manifest.json          # Cấu hình extension
├── popup.html             # Giao diện popup
├── popup.css              # Styles cho popup
├── popup.js               # Logic popup
├── content.js             # Content script
├── background.js          # Background script
├── icons/                 # Thư mục icons
│   ├── icon16.svg
│   ├── icon32.svg
│   ├── icon48.svg
│   └── icon128.svg
└── README.md              # Tài liệu hướng dẫn
```

## Phát triển

### Yêu cầu
- Chrome Browser
- Developer Mode enabled

### Chạy extension
1. Clone hoặc download source code
2. Mở Chrome Extensions (`chrome://extensions/`)
3. Bật Developer Mode
4. Click "Load unpacked" và chọn thư mục dự án

### Debugging
- Popup: Click chuột phải vào popup → Inspect
- Background: Extensions page → Background page → Inspect
- Content Script: F12 trên trang web → Console

## Permissions

Extension yêu cầu các quyền sau:
- `activeTab`: Truy cập tab hiện tại
- `storage`: Lưu trữ dữ liệu
- `tabs`: Quản lý tabs
- `<all_urls>`: Hoạt động trên mọi website

## Changelog

### Version 1.0
- Tính năng lưu và tự động điền thông tin đăng nhập
- Giao diện popup responsive
- Context menu integration
- Badge notifications
- Auto-detect login forms

## Hỗ trợ

Nếu gặp vấn đề hoặc có góp ý, vui lòng:
1. Kiểm tra Console để xem lỗi
2. Thử reload extension
3. Liên hệ developer

## License

MIT License - Xem file LICENSE để biết thêm chi tiết.

---

**Lưu ý**: Extension này được phát triển cho mục đích học tập và sử dụng cá nhân. Vui lòng sử dụng có trách nhiệm và tuân thủ các quy định về bảo mật thông tin.