# Trái ngọt Bắc Ninh

Ứng dụng React/TypeScript quản lý nhà vườn, bán trái cây và truy xuất nguồn gốc. Firebase Authentication quản lý tài khoản; Cloud Firestore lưu dữ liệu và đồng bộ giữa các thiết bị theo thời gian thực. Express cung cấp API AI tùy chọn.

## Chức năng đã triển khai

- Đăng ký/đăng nhập bằng email và mật khẩu, xác minh email, khôi phục mật khẩu. Mật khẩu chỉ gửi tới Firebase Authentication; không lưu vào Firestore, mã nguồn hay localStorage của ứng dụng.
- Chủ vườn khai báo địa chỉ, tọa độ, ảnh và giấy chứng nhận trong hồ sơ riêng tư. Quản trị duyệt tài khoản và từng bản sửa hồ sơ trước khi mở quyền đăng thông tin; bản công khai chỉ đổi sau khi được duyệt.
- Đăng/sửa nhiều trái cây; quyền sở hữu dựa trên UID. Chặn lưu bản sửa cũ nếu tồn kho hoặc bài đăng vừa được cập nhật từ nơi khác.
- Nhật ký tưới, bón phân, BVTV và công việc theo từng trái cây. Không tự tạo lịch sử hay gắn trạng thái “đã kiểm định an toàn” cho bản ghi mới.
- QR PNG độ phân giải 1.000 px, có khoảng trắng chuẩn để in tem. Mỗi QR dẫn tới `/#trace/<productId>`, mở công khai trên điện thoại và luôn đọc hồ sơ/nhật ký hiện tại.
- Đặt hàng COD: mỗi loại trái cây tạo một đơn riêng cho đúng nhà vườn, tối đa 5 loại/lần đặt. Ghi đơn và giữ tồn kho trong cùng transaction; thử lại cùng mã giao dịch không trừ kho lần nữa.
- Chủ vườn xem thông tin giao nhận, xác nhận, đóng gói, giao hàng, hoàn tất hoặc hủy trước khi giao. Hủy đơn hoàn tồn kho atomically. Khách mua theo dõi đơn của mình tại “Quản lý đơn hàng”.
- Bài viết, ảnh, bình luận và lượt thích cộng đồng lưu trên Firestore. Chỉ tài khoản đã xác minh email và được quản trị duyệt được đăng/chỉnh thông tin công khai.

Thông tin nhà vườn đã duyệt, trái cây và nhật ký được công khai để truy xuất. Thông tin người nhận đơn chỉ người mua và nhà vườn bán sản phẩm được đọc. Email đăng nhập nằm trong Authentication và hồ sơ đăng ký riêng tư cho chủ tài khoản/quản trị; không nằm trong hồ sơ công khai.

## Trạng thái dịch vụ

Cấu hình web cho dự án `trai-ngot-bac-ninh` đã được điền vào `.env.local` trên máy này. Tệp bị Git bỏ qua.

Đã triển khai ngày 27/10/2026 tại https://trai-ngot-bac-ninh.web.app. Email/Password và Anonymous đã bật; Firestore `(default)` Standard Native ở `asia-southeast1` đã được tạo; rules/indexes đã phát hành cùng website. Dự án giữ gói Spark.

Thời tiết và mô hình 3D hiện là minh họa. Tư vấn chuyên gia lưu hội thoại thật trên Firestore. Trợ lý AI/chẩn đoán bệnh dùng Firebase AI Logic + App Check trên Hosting, hoặc Express backend + GEMINI_API_KEY; khi thiếu kết nối hoặc lỗi nhà cung cấp, giao diện báo lỗi rõ, không tự trả bệnh/câu trả lời mẫu. Xem hướng dẫn chạy và giới hạn kiểm thử tại docs/AI-operation-2026-11-02.md. Quản trị duyệt tài khoản và thông tin nhà vườn; chứng nhận vẫn ghi là nhà vườn tự khai, không thay thế xác thực với cơ quan cấp giấy.

## Quản trị và duyệt nhà vườn

Tài khoản quản trị được người sở hữu chỉ định: **giapvankhiem@gmail.com**. Tải lại trang để nhận quyền mới, rồi vào **Quản trị & Duyệt hồ sơ**. Quản trị xem các tài khoản mới/chờ duyệt/đã duyệt/cần bổ sung/khóa quyền; kiểm tra ảnh vườn, bản đồ và giấy đính kèm; duyệt hoặc yêu cầu bổ sung kèm lý do. Khi khóa quyền đăng, nhà vườn vẫn xử lý được đơn hàng đã phát sinh; quản trị có thể mở lại để yêu cầu bổ sung.

Đăng ký chỉ tạo hồ sơ riêng tư trạng thái `draft`. Sau khi xác minh email, chủ vườn vào **Tổng quan → Hoàn thiện hồ sơ & gửi duyệt** để chuyển `pending`. Chỉ `approved` mới được đăng/sửa trái cây, nhật ký công khai, bài viết và bình luận. Mỗi lần sửa hồ sơ/giấy tờ tạo revision mới cần duyệt lại; bản công khai trước đó vẫn được giữ. Firestore Rules chặn tự duyệt, giả quyền, đọc hồ sơ/email người khác và sửa giấy đang duyệt mà không tăng revision.

Quyền quản trị dùng custom claim `admin` trong Firebase Auth do môi trường tin cậy cấp; không dựa vào email/role tự khai từ trình duyệt. `node scripts/admin-account.mjs --email=<email>` chỉ tra cứu; thêm `--grant` để cấp quyền cho tài khoản có sẵn, giữ claims khác và không thay mật khẩu. Không đưa token hoặc khóa dịch vụ vào frontend.

`node scripts/prepare-farmer-review.mjs` lập kế hoạch đưa hồ sơ công khai cũ vào hàng chờ; `--apply` sao chép sang vùng riêng tư và tạo backup trong `.tools`, không tự duyệt hay thay/xóa dữ liệu công khai cũ. Hồ sơ cũ chưa duyệt không được đăng thêm thông tin. Lịch sử quyết định ở `farmerApplications/{uid}/reviews`, không được ghi đè/xóa từ client.

## Chạy tại máy

Yêu cầu Node.js 22.12+.

```powershell
npm ci
# Chỉ sao chép khi chưa có .env.local; không ghi đè cấu hình đã điền.
Copy-Item .env.example .env.local
npm run dev
```

Mở `http://localhost:3000`. Firebase SDK dùng cấu hình `VITE_FIREBASE_*` trong `.env.local`. Không đưa service-account JSON hay mật khẩu vào các biến `VITE_*`; các biến này xuất hiện trong bản build trình duyệt.

## Cấu hình và triển khai Firebase

1. Trong Firebase Console của `trai-ngot-bac-ninh`, mở Authentication → Get started. Bật **Email/Password** và **Anonymous**. Anonymous tạo danh tính người mua khi đặt hàng; tài khoản này không có quyền quản lý vườn.
2. Trong Authentication → Settings, thêm domain website vào Authorized domains: `trai-ngot-bac-ninh.web.app`, `trai-ngot-bac-ninh.firebaseapp.com`; thêm `localhost` nếu cần phát triển. Thiết lập password policy tối thiểu 10 ký tự; kiểm tra mẫu email xác minh và khôi phục.
3. Tạo Cloud Firestore **Standard / Native mode**, database `(default)`, chọn khu vực phù hợp (gợi ý Singapore `asia-southeast1`). Bắt đầu bằng **production mode**, không mở test mode cho dữ liệu thật.
4. Đăng nhập CLI và triển khai:

```powershell
npx firebase login
npm run lint
npm test
npm run test:firebase
npm run deploy:firebase
```

`deploy:firebase` kiểm tra biến cấu hình, build với base `/`, rồi triển khai Hosting + rules/indexes vào đúng dự án `trai-ngot-bac-ninh`. Script không tạo billing account hay nâng gói dịch vụ.

`firestore.rules` là lớp phân quyền bắt buộc, không thay thế bằng `allow read, write: if true`. Cần deploy rules cùng ứng dụng. Dữ liệu mới của môi trường production bắt đầu trống; không tự nạp tài khoản, chứng nhận hoặc đơn hàng mẫu.

`VITE_PUBLIC_SITE_URL` phải là URL HTTPS đã triển khai trước khi in tem QR. Đổi tên miền sau khi in sẽ cần duy trì chuyển hướng tại tên miền cũ. Firebase web API key là cấu hình công khai; quyền truy cập dữ liệu được bảo vệ bằng Auth và Security Rules.

Firebase App Hosting là dịch vụ khác với Hosting. Bản Vite này dùng Firebase Hosting để phục vụ tệp tĩnh và kết nối trực tiếp tới Auth/Firestore. Không cần tạo App Hosting backend cho các chức năng bán hàng/truy xuất.

Tem QR chỉ có tại **bài đăng trái cây → Tem QR đóng hộp**, dành cho chủ bài đăng. Sau khi lưu bài đăng mới thành công, ứng dụng tự mở mục này để chủ vườn tải PNG và in dán hộp. Để tải lại, mở **Xem vườn & log** của bài rồi chọn **Tem QR đóng hộp**. Tổng quan và các mục thông tin công khai không lặp lại mã QR. Mỗi bài có URL truy xuất riêng; người mua quét tem xem đúng trái cây, hồ sơ/chứng nhận nhà vườn, vị trí và nhật ký mà không cần đăng nhập. Những tem đã in vẫn dùng URL cũ.

## Kiểm thử

### Khai báo giấy chứng nhận

Vào **Tổng quan → Sửa hồ sơ & vị trí vườn → Giấy chứng nhận trái cây (nếu có)**. Mỗi vườn khai báo tối đa 6 hồ sơ: VietGAP, GlobalGAP, OCOP (3/4/5 sao), hữu cơ, an toàn thực phẩm hoặc loại khác. Mỗi hồ sơ có tên, số chứng nhận/quyết định, đơn vị cấp, ngày cấp, ngày hết hạn tùy chọn, phạm vi sản phẩm/vùng trồng và ghi chú. Có thể tải ảnh JPG/PNG/WebP tối đa 10 MB để ứng dụng nén, hoặc dán liên kết HTTPS tới bản chứng nhận/PDF đầy đủ.

Bản chờ duyệt nằm ở `farmerApplications/{uid}.profile`, giấy và ảnh nén tại `farmerApplications/{uid}/certificates/{id}`; chỉ chủ hồ sơ/quản trị đọc được. Quản trị duyệt bằng transaction để xuất bản sang `farmers/{uid}` và `farmers/{uid}/certificates/{id}` cùng trạng thái duyệt/lịch sử. Không phụ thuộc lưu trữ trình duyệt hoặc Cloud Storage. Ảnh mỗi giấy tối đa 140.000 ký tự data URL; không bắt buộc có giấy để gửi duyệt hồ sơ.

Khách xem bản đã duyệt ở trang chi tiết và QR qua listener. Thêm/sửa/xóa giấy trong bản chờ chưa đổi dữ liệu công khai; khi quản trị duyệt, giấy bị bỏ mới được xóa khỏi bản công khai và thu hồi quyền đọc. Bài trái cây không lưu bản sao chứng nhận. Trạng thái chứng chỉ vẫn là **tự khai/chưa xác minh**; duyệt hồ sơ không thay thế kiểm định chất lượng. Chủ vườn không được tự ghi `verified: true`, không có con dấu hoặc giấy chứng nhận dựng giả.

Các bài trái cây cũ và tem QR đã in dùng được với phần bổ sung này, không cần chuyển dữ liệu hoặc đổi URL.

| Lệnh | Phạm vi |
| --- | --- |
| `npm test` | Quyền sở hữu bằng UID, validation AI, trạng thái đơn, nhật ký, thông tin giao nhận, giải mã QR PNG và 8 ca HTTP cục bộ (Gemini tắt). |
| `npm run test:rules` | Phân quyền Firestore, chống giả giá, quyền riêng tư đơn, giữ tồn kho, mua đồng thời, hoàn kho và realtime. |
| `npm run test:datasets` | 100 ca với 24 chủ vườn, 24 khách ẩn danh, 144 sản phẩm nền/sáu loại cây, dữ liệu biên, phân trang, giỏ nhiều người bán, 12 khách mua/hủy đồng thời và giới hạn nhật ký. |
| `npm run test:firebase` | Rules, service Firebase và form React/JSDOM: đăng ký/xác minh/khôi phục, vị trí, trái cây, bốn nhật ký, đặt hàng nhiều nhà vườn, giao/hủy, cộng đồng, QR và quyền riêng tư. |
| `npm run lint` | TypeScript. |
| `npm run build:firebase` | Kiểm tra cấu hình và tạo bản Hosting. |
| `node scripts/check-live-site.mjs` | Chỉ đọc website thật: đối chiếu SHA256 các tệp với `dist`, kiểm tra truy xuất công khai và chặn truy cập đơn hàng chưa xác thực. Chạy sau khi build/triển khai. |

Emulator cần Java 21+. Trên máy Windows hiện tại, runtime đã được tải và kiểm tra SHA256 trong `.tools/java`; script kiểm thử tự tìm runtime này và dùng thư mục socket ngắn để tránh lỗi đường dẫn Windows. `.tools` không được đưa vào Git. Trên máy khác cài Java 21 và đặt `JAVA_HOME`.

Kiểm thử luôn dùng dự án giả `demo-traingot`, không ghi dữ liệu thử lên production. CI trong `.github/workflows/verify.yml` cài Java 21 và chạy các kiểm tra này.

Tài khoản và mật khẩu trong các tệp test chỉ dùng cho Emulator; email thuộc miền dành riêng `example.test`. Bộ workflow xác minh bằng mã thư của Auth Emulator; bộ dữ liệu lớn đánh dấu tài khoản đã xác minh qua API quản trị cục bộ để dựng fixture. Bộ test tự tạo tài khoản chủ vườn/khách mua rồi dừng Emulator khi kết thúc; không xuất dữ liệu thử vào production. Đây không phải tài khoản đăng nhập website thật. Kiểm thử React dùng DOM mô phỏng, không thay thế kiểm thử camera/GPS vật lý, in tem hoặc trải nghiệm trên điện thoại thật.

Bộ dữ liệu mở rộng có cấu trúc cố định `20261028` trong `tests/fixtures/datasets.ts`. Kết quả số lượng tạo thực tế được ghi vào `.tools/qa-datasets-summary.json`; thư mục này bị bỏ qua bởi Git. `test:firebase` đã bao gồm `test:datasets`, không cần chạy cả hai liên tiếp trừ khi chẩn đoán lỗi.

Chrome đã kết nối lại để cấu hình Authentication. Các kiểm thử giao dịch và đăng ký dùng Emulator để không tạo dữ liệu giả trên production. Chủ vườn cần tự đăng ký tài khoản thật và xác minh email để bắt đầu sử dụng.

## Giao diện và SEO trên Firebase

### Tạm dừng, xóa khỏi website và khôi phục nhà vườn

Trong **Quản trị & Duyệt hồ sơ**, chọn trạng thái hồ sơ phù hợp (hoặc tất cả), mở hồ sơ và dùng mục **Quản lý hoạt động tài khoản**. Mỗi thao tác bắt buộc lý do; xóa khỏi website cần nhập đúng email nhà vườn. Có thể lọc tài khoản theo hoạt động và xem lịch sử xử lý riêng tư.

Đây là quản lý quyền hoạt động **trên website**, có thể khôi phục; chưa khóa/xóa Firebase Authentication. Khi tạm dừng hoặc xóa, sản phẩm bị ẩn trong giao diện realtime và Rules chặn ghi hồ sơ, trái cây, nhật ký, cộng đồng và đơn mới của tài khoản/nhà vườn đó. Đơn cũ và dữ liệu lịch sử được giữ, không tự hủy đơn hoặc điều chỉnh tồn kho. Khôi phục hoạt động không thay thế việc duyệt hồ sơ.

Trạng thái tối thiểu công khai nằm ở `farmerAccountStates`; lý do và người xử lý nằm trong `farmerAccountActions`, chỉ quản trị và chính chủ hồ sơ được đọc. Thay đổi trạng thái và thêm lịch sử thực hiện trong một transaction, có kiểm tra phiên bản; không cho sửa/xóa lịch sử, tự mở khóa hoặc xử lý tài khoản quản trị đang dùng. Không chạy thao tác xử lý trên tài khoản thật để kiểm thử.

HTML SEO là ảnh chụp ở thời điểm build: bản dựng tiếp theo bỏ các nhà vườn bị ẩn khỏi HTML và sitemap; nội dung SEO đã phát hành cần triển khai Hosting lại để cập nhật. Quyền tạo đơn luôn được Rules kiểm tra kể cả khách giữ trang/giỏ cũ. Khi triển khai tính năng lần đầu, phát hành Rules trước rồi chạy `npm run build:firebase` và triển khai Hosting.

Khóa hoặc xóa hẳn người dùng Firebase Authentication cần backend tin cậy có Admin SDK. Dự án hiện chưa bật thanh toán và Cloud Functions API; việc triển khai Cloud Functions yêu cầu [gói Blaze](https://firebase.google.com/docs/functions/get-started). Không đặt khóa quản trị hoặc token Firebase CLI trong frontend.

Trang chủ dùng nhận diện xanh rừng, nền kem, phông tiếng Việt tự lưu và bố cục responsive. Các luồng nhà vườn, duyệt hồ sơ, đơn hàng và tem QR tiếp tục dùng Firebase như trước.

Nội dung giao diện dùng Quicksand, tiêu đề xanh than và xanh ngọc theo mẫu Webtop người dùng chỉ định. Cỡ chữ và bố cục giữ nguyên; chi tiết màu/phông và kiểm chứng được ghi trong [báo cáo phong cách tham khảo](docs/reference-style-webtop-2026-10-28.md). [Báo cáo đồng bộ kiểu chữ trước đó](docs/typography-2026-10-28.md) lưu quy chuẩn cỡ chữ và lịch sử điều chỉnh.

`npm run build:firebase` dựng thêm HTML trang chủ/trang trái cây, metadata chia sẻ, canonical, JSON-LD, robots và sitemap từ danh mục Firestore công khai. URL mới là `/nong-san/{id}`; QR `/#trace/{id}` đã in vẫn mở được. Bài kiểm thử có `noindex` và không vào sitemap.

Giao diện vẫn đồng bộ realtime; **HTML SEO và sitemap cập nhật khi build/triển khai lại**, nên cần triển khai Hosting sau khi thêm/sửa/gỡ bài thật. Chưa có tự động gửi sitemap lên Search Console hoặc cam kết thứ hạng. Xem phạm vi, kết quả 216 kiểm tra và lệnh triển khai trong [báo cáo giao diện/SEO](docs/UI-SEO-2026-10-28.md).

## GitHub Pages (phương án phụ)

`npm run build` vẫn dùng tiền tố `/traingotbacninh/`; có thể đặt `VITE_BASE_PATH` để thay đổi. Nếu tiếp tục dùng workflow Pages, khai báo các repository variables `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, `VITE_PUBLIC_SITE_URL`. Workflow sẽ dừng khi thiếu cấu hình thay vì xuất bản website không kết nối dữ liệu.

## Cấu trúc

```text
src/lib/firebase.ts                Khởi tạo Firebase / kết nối Emulator
src/hooks/useFarmData.ts           Listener dữ liệu và hồ sơ nhà vườn
src/services/farmStore.ts          Ghi hồ sơ, trái cây, nhật ký và transaction đơn hàng
src/components/AuthModal.tsx       Đăng ký, đăng nhập, xác minh và khôi phục
src/components/OrdersTab.tsx       Quản lý đơn bán / theo dõi đơn mua
src/components/Traceability.tsx    QR PNG và trang truy xuất công khai
firestore.rules                   Phân quyền phía Firebase
firebase.json                     Hosting, rules, indexes và Emulator
tests/                            Kiểm thử nghiệp vụ và Firebase
```

Ảnh tải lên được nén và giới hạn trước khi lưu trong document; không phụ thuộc Cloud Storage. Mỗi loại nhật ký giới hạn 500 bản ghi trên một trái cây. Khi quy mô tăng cần chuyển ảnh sang kho đối tượng, tách nhật ký thành subcollection và bổ sung phân trang/quota chống spam ở backend.

### Tư vấn chuyên gia

Nhà vườn gửi yêu cầu riêng trong **Trợ lý & Chuyên gia → Kết nối chuyên gia**. Quản trị có hai mục **Yêu cầu tư vấn** và **Tài khoản chuyên gia** để phân công, trả lời, xác nhận, tạm dừng hoặc hủy quyền tư vấn. Chỉ tài khoản đã được xác nhận mới nhận và trả lời yêu cầu được giao; hội thoại lưu trong Firestore, không có chuyên gia hoặc phản hồi minh họa.

Kiểm thử riêng: `node scripts/run-firebase-tests.mjs --consultations`. Kiểm thử giao diện: `node scripts/run-firebase-tests.mjs --ui`. Bộ `npm run test:firebase` bao gồm cả tư vấn. Xem [biên bản kiểm thử](docs/expert-support-qa-2026-10-30.md). Năm tài khoản nội bộ đã tạo đang chờ quản trị bổ sung thông tin thật và xác nhận; thông tin đăng nhập chỉ lưu cục bộ trong `.tools/` được Git bỏ qua.
