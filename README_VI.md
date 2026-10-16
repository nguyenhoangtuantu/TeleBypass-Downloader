<div align="center">

<img src="./src/assets/icon_128.png" alt="TeleBypass Downloader Logo" width="96" height="96" />

# TeleBypass Downloader (Tiếng Việt)

### ⚡ Công cụ tải Video & File Telegram bị cấm tải (Bypass Restricted Content)

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-success?style=for-the-badge&logo=googlechrome&logoColor=white)](manifest.json)
[![Platform Telegram Web](https://img.shields.io/badge/Telegram_Web-K_%26_A-0088cc?style=for-the-badge&logo=telegram&logoColor=white)](https://web.telegram.org)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue?style=for-the-badge)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/nguyenhoangtuantu/TeleBypass-Downloader?style=for-the-badge&color=ffd700)](https://github.com/nguyenhoangtuantu/TeleBypass-Downloader/stargazers)

**[ English ](README.md)** • **[ Tiếng Việt ](README_VI.md)**

*Extension mã nguồn mở cho trình duyệt nhân Chromium giúp tải video, ảnh, ghi âm và tài liệu từ các channel/group Telegram bị bật chế độ hạn chế (cấm lưu, cấm chuyển tiếp nội dung).*

</div>

---

## 💡 Vấn đề giải quyết

Khi tham gia các nhóm học tập, tài liệu hoặc channel tin tức trên Telegram, rất nhiều quản trị viên bật tính năng:
> **"Saving content is prohibited" (Nghiêm cấm lưu trữ và chuyển tiếp nội dung)**

Điều này khiến bạn không thể tải bài giảng hay tài liệu quan trọng về máy để xem offline. Các giải pháp dùng Bot Telegram bên ngoài thì thường đòi hỏi quyền truy cập tài khoản, giới hạn dung lượng file hoặc có nguy cơ đánh cắp thông tin cá nhân.

**TeleBypass Downloader** giải quyết triệt để vấn đề này trực tiếp trên trình duyệt máy tính của bạn:
- Tải ngay tại chỗ, giữ nguyên 100% chất lượng gốc.
- Không gửi bất kỳ dữ liệu nào ra máy chủ bên ngoài.
- Tự động gắn nút Download tiện lợi vào giao diện Telegram Web.

---

## ✨ Tính năng nổi bật

- 🔓 **Vượt rào cấm tải (Bypass Saving Prohibited):** Tải mượt mà toàn bộ video, audio, voice note, hình ảnh từ các nhóm/kênh bị hạn chế.
- ⚡ **Hỗ trợ tải hàng loạt (Batch Download) có kiểm soát hàng đợi:** Tích hợp bộ giới hạn tối đa 2 tác vụ tải song song, ngăn chặn hoàn toàn tình trạng tràn RAM (Out of Memory) hoặc sập tab trình duyệt khi tải nhiều file nặng.
- 🎯 **Giao diện trực quan tích hợp sẵn:** Nút tải xuất hiện tự nhiên ngay trên trình phát video của cả **Telegram Web K** (`web.telegram.org/k`) và **Telegram Web A** (`web.telegram.org/a`).
- 🛡️ **Bảo mật tuyệt đối (100% Client-Side):**
  - Không có server trung gian.
  - Không lưu trữ hay can thiệp vào session/token tài khoản Telegram của bạn.
  - Chạy an toàn trong môi trường extension của chính máy bạn.
- 🧠 **Cơ chế dọn dẹp bộ nhớ tối ưu:** Thu hồi Blob URL nhanh chóng (sau 3 giây) và giải phóng binary buffer ngay khi hoàn tất.
- 💬 **Xuất lịch sử chat & media:** Hỗ trợ lưu trữ tin nhắn với cơ chế lọc XSS an toàn.
- 🌍 **Đa ngôn ngữ:** Hỗ trợ hơn 50 ngôn ngữ (bao gồm tiếng Việt).

---

## 🚀 Hướng dẫn cài đặt và sử dụng (Chưa đầy 1 phút)

Dùng được trên mọi trình duyệt Chromium: **Google Chrome, Brave, Microsoft Edge, Opera, Cốc Cốc, Kiwi Browser (Android)**.

### Bước 1: Tải source code về máy
- Cách 1: Bấm nút xanh **Code** ở góc trên bên phải trang GitHub này > chọn **Download ZIP**, sau đó giải nén ra một thư mục.
- Cách 2: Dùng lệnh Git:
```bash
git clone https://github.com/nguyenhoangtuantu/TeleBypass-Downloader.git
```

### Bước 2: Cài vào trình duyệt
1. Mở trình duyệt và truy cập vào: `chrome://extensions/` (hoặc `edge://extensions/` nếu dùng Edge, `coccoc://extensions/` nếu dùng Cốc Cốc).
2. Bật công tắc **Chế độ dành cho nhà phát triển (Developer mode)** ở góc trên bên phải.
3. Bấm vào nút **Tải tiện ích đã giải nén (Load unpacked)** ở góc trên bên trái.
4. Chọn đúng thư mục `TeleBypass-Downloader` vừa giải nén.

### Bước 3: Thưởng thức
1. Truy cập vào [web.telegram.org/k](https://web.telegram.org/k) hoặc [web.telegram.org/a](https://web.telegram.org/a).
2. Mở channel hoặc group Telegram mà bạn muốn tải.
3. Rê chuột vào video hoặc bấm mở xem video, bạn sẽ thấy nút **Tải xuống (Download)** xuất hiện. Bấm vào để lưu file về máy.

---

## 🔬 Cơ chế kỹ thuật (Under the Hood)

Telegram Web giải mã và phát media trên trình duyệt bằng các công nghệ chuẩn HTML5 `<video>`, Web Streams và bộ đệm IndexedDB. Khi một kênh cấm tải, Telegram thực chất chỉ dùng CSS/Javascript ở giao diện để vô hiệu hóa menu chuột phải và ẩn nút chia sẻ.

**TeleBypass Downloader** chặn bắt trực tiếp luồng stream media đã được giải mã ngay trong bộ đệm của phiên làm việc hiện tại, gom các chunk dữ liệu lại thành Blob hoàn chỉnh và kích hoạt cơ chế tải file gốc của trình duyệt. Quá trình này hoàn toàn diễn ra tại máy client, không qua bất kỳ máy chủ bên thứ ba nào.

---

## 🧪 Kiểm thử tính ổn định

Dự án có sẵn bộ test tự động kiểm tra rò rỉ bộ nhớ, kiểm soát hàng đợi và bảo mật XSS:

```bash
node tests/test_memory_fixes.js
node tests/test_batch_queue.js
node tests/test_security_fixes.js
```

---

## ⚠️ Tuyên bố miễn trừ trách nhiệm (Disclaimer)

Dự án này được phát triển phục vụ mục đích **học tập, nghiên cứu kỹ thuật và sao lưu dữ liệu cá nhân hợp pháp**. Tác giả không chịu trách nhiệm đối với bất kỳ hành vi sử dụng công cụ sai mục đích hoặc vi phạm bản quyền nội dung. Vui lòng tôn trọng quyền sở hữu trí tuệ của người tạo nội dung.

---

## ⭐ Đừng quên ủng hộ dự án

Nếu công cụ này giúp ích cho bạn, hãy nhấn tặng tác giả một nút **Star ⭐** trên GitHub nhé! Đó là động lực rất lớn để dự án tiếp tục được duy trì và hoàn thiện.
