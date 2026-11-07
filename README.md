# Exact Echo

میرے پاس ایک ZIP فائل کے اندر مکمل ویب سائٹ پروجیکٹ موجود ہے جو پہلے سے تیار شدہ (fully built) ہے۔

🎯 مقصد:

صرف موجودہ ویب سائٹ کے کوڈ کو کاپی/ریفلیکٹ کرنا ہے اور اسے بالکل ویسا ہی ریٹرن کرنا ہے، بغیر کسی تبدیلی کے۔

❌ سخت پابندیاں:

 کسی بھی قسم کی نئی فیچر ایڈ نہیں کرنی

 کوئی UI/UX تبدیلی نہیں کرنی

 کوئی رنگ (colors) تبدیل نہیں کرنے

 کوئی layout یا design modify نہیں کرنا

 کوئی optimization یا refactoring نہیں کرنی

 کوئی فائل ڈیلیٹ یا rename نہیں کرنی

 کوئی logic یا code structure نہیں بدلنا

✅ اجازت صرف یہ ہے:

 ZIP فائل کے اندر موجود تمام فائلوں کو ویسا ہی extract کرنا

 ہر فائل کو exact same content کے ساتھ copy کرنا

 اور ایک updated ZIP واپس دینا جس میں 100% identical code ہو

⚠️ خاص ہدایت:

یہ ایک production-level project ہے۔
اس لیے “smart suggestions”، “improvements” یا “auto fixes” بالکل بھی نہیں کرنے۔

صرف اور صرف byte-to-byte same project replication چاہیے۔

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f6cc1c2b-958e-49eb-a1fc-cb7bb7d33471).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
