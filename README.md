# Telegram Everyone Mention Bot (Local)

Bot Telegram hỗ trợ lệnh `/all` để tag mọi người trong group (dựa trên danh sách thành viên bot đã ghi nhận).

## 1) Chuẩn bị

- Node.js >= 18
- Telegram account
- Group để test

## 2) Đăng ký bot với BotFather

1. Mở Telegram, tìm `@BotFather`.   
2. Gõ `/newbot` và làm theo hướng dẫn.
3. Lấy bot token.
4. (Khuyến nghị) Gõ `/setprivacy` -> chọn bot -> chọn **Disable** để bot đọc được tin nhắn trong group.
5. Add bot vào group test.
6. Cấp quyền admin cho bot (ít nhất quyền gửi tin nhắn).

## 3) Cài và chạy local

```bash
npm install
cp .env.example .env
```

Mở file `.env` và thay `BOT_TOKEN` bằng token thật.

Chạy bot:

```bash
npm run dev
```

## 4) Logic đã có

- Tự lưu member khi:
  - có tin nhắn trong group
  - có user mới join
- `/all`: chỉ admin/owner mới dùng được, có cooldown.
- `/optout`: user tự loại mình khỏi danh sách tag.
- `/optin`: bật lại để được tag.

## 5) Cách test nhanh

1. Trong group, mỗi member gửi ít nhất 1 tin nhắn.
2. Admin gõ `/all`.
3. Bot sẽ gửi mention theo batch (tránh vượt giới hạn ký tự).

## 6) Lưu ý giới hạn Telegram

- Bot không thể tự quét toàn bộ member group chỉ bằng Bot API.
- Member chưa từng tương tác/join event mà bot chưa thấy thì không có trong DB.


token: 8687313696:AAGeN0SalW69x3YYOle9pdwEFqrzou9XI6Q