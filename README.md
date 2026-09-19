# Asset Management System

Hệ thống quản lý vòng đời tài sản doanh nghiệp, bao gồm tài sản, nhân viên, nhà cung cấp, mua sắm, điều chuyển, sửa chữa, kiểm kê và thanh lý.

## Cấu trúc dự án

```text
asset-manager/
├── backend/   # REST API
└── mobile/    # Ứng dụng nhân viên
```

## Backend

### Mục tiêu

Cung cấp REST API cho quản lý tài sản và các quy trình mua sắm, điều chuyển, sửa chữa; hỗ trợ JWT, phân quyền theo vai trò và audit trail.

### Tech stack chính

- NestJS, TypeScript
- PostgreSQL 16 chạy bằng Docker
- Drizzle ORM
- JWT
- Swagger / OpenAPI
- Vitest
- Docker Compose

### Yêu cầu

- Node.js 20+
- npm
- Docker và Docker Compose
- GNU Make nếu sử dụng các lệnh `make`

### Cài đặt và chạy

```bash
cd backend
npm install
```

Tạo file môi trường:

```bash
cp .env.example .env
```

Điền cấu hình cần thiết trong `.env`, sau đó khởi động PostgreSQL:

```bash
make infra-up
```

Nếu máy không có `make`:

```bash
docker compose up -d
```

Đồng bộ schema và tạo dữ liệu mẫu:

```bash
npm run db:push
npm run db:seed
```

Chạy API ở chế độ development:

```bash
npm run start:dev
```

API mặc định: `http://localhost:8080`

Swagger: `http://localhost:8080/api-docs`

### Quản lý hạ tầng

```bash
# Khởi động PostgreSQL
make infra-up

# Dừng PostgreSQL nhưng giữ dữ liệu
make infra-down

# Dừng PostgreSQL và xóa toàn bộ dữ liệu
make infra-clean
```

### Build và kiểm tra

```bash
npm run build
npm run start:prod
npm run lint
npm run test
npm run test:e2e
```

## Mobile

### Mục tiêu

Ứng dụng dành cho nhân viên để đăng nhập, xem tài sản được giao, quét QR và gửi yêu cầu sửa chữa kèm ảnh hoặc video.

### Tech stack chính

- Flutter, Dart
- Dio
- Flutter Secure Storage
- Mobile Scanner
- Image Picker
- Video Player

### Yêu cầu

- Flutter SDK hỗ trợ Dart 3.13+
- Android Studio và Android SDK
- JDK 17
- Xcode trên macOS nếu build iOS
- Thiết bị thật hoặc emulator/simulator

Kiểm tra môi trường:

```bash
flutter doctor
```

### Cài đặt và chạy

```bash
cd mobile
flutter pub get
flutter run
```

Chỉ định địa chỉ backend khi cần:

```bash
flutter run --dart-define=API_URL=http://<backend-host>:8080
```

Với Android Emulator, địa chỉ mặc định là:

```text
http://10.0.2.2:8080
```

### Build

```bash
# Android
flutter build apk

# Web
flutter build web

# iOS — yêu cầu macOS và Xcode
flutter build ios
```
