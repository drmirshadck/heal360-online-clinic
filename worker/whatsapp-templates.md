# WhatsApp templates for Heal 360 Online Clinic (create in Meta → WhatsApp Manager → Message templates)

Category: **Utility** for all 10. Header/footer/buttons: none. Each message always names the clinic and carries the website address.
Variables must be filled with an example when submitting. A template can't start or end with a variable, so each ends with fixed text.
Name the templates exactly as below (English language code `en`; Malayalam language code `ml`, name + `_ml`).
The patient picks English or Malayalam on the booking form; the helper uses the matching template.

Example values: {{1}} Asha · {{2}} New consultation · {{3}} Dr. Seena Naseem K.A. · day Mon, 30 Nov · time 5:30 pm · link https://example.com/room · clinic Heal 360 Online Clinic · site https://www.heal360homoeopathy.com/

## 1. booking_received  (variables: 1 name, 2 consultation, 3 doctor, 4 day, 5 time, 6 clinic, 7 website)
EN: Hello {{1}}, we have received your booking request for {{2}} with {{3}} on {{4}} at {{5}} (IST). The doctor will confirm it shortly. {{6}} · {{7}} Thank you.
ML: നമസ്കാരം {{1}}, {{3}}-യുമായുള്ള {{2}}-നായി {{4}}, {{5}}-ന് (IST) ബുക്ക് ചെയ്ത നിങ്ങളുടെ അഭ്യർത്ഥന ഞങ്ങൾക്ക് ലഭിച്ചു. ഡോക്ടർ ഉടൻ സ്ഥിരീകരിക്കും. {{6}} · {{7}} നന്ദി.

## 2. booking_confirmed  (1 name, 2 consultation, 3 doctor, 4 day, 5 time, 6 video-room link, 7 clinic, 8 website)
EN: Hello {{1}}, your {{2}} with {{3}} is confirmed for {{4}} at {{5}} (IST). At that time, join the video consultation here: {{6}} — {{7}} · {{8}} Thank you.
ML: നമസ്കാരം {{1}}, {{3}}-യുമായുള്ള നിങ്ങളുടെ {{2}} {{4}}, {{5}}-ന് (IST) സ്ഥിരീകരിച്ചു. ആ സമയത്ത് വീഡിയോ കൺസൾട്ടേഷനിൽ ചേരാൻ ഈ ലിങ്ക് തുറക്കുക: {{6}} — {{7}} · {{8}} നന്ദി.

## 3. reminder_24h  (1 name, 2 doctor, 3 day, 4 time, 5 link, 6 clinic, 7 website)
EN: Hello {{1}}, a reminder: your consultation with {{2}} is tomorrow, {{3}} at {{4}} (IST). Join here: {{5}} — {{6}} · {{7}} Thank you.
ML: നമസ്കാരം {{1}}, ഓർമ്മപ്പെടുത്തൽ: {{2}}-യുമായുള്ള നിങ്ങളുടെ കൺസൾട്ടേഷൻ നാളെ, {{3}}, {{4}}-ന് (IST) ആണ്. ചേരാൻ: {{5}} — {{6}} · {{7}} നന്ദി.

## 4. reminder_30m  (1 name, 2 doctor, 3 time, 4 link, 5 clinic, 6 website)
EN: Hello {{1}}, your consultation with {{2}} starts in 30 minutes, at {{3}} (IST). Join here: {{4}} — {{5}} · {{6}} Thank you.
ML: നമസ്കാരം {{1}}, {{2}}-യുമായുള്ള നിങ്ങളുടെ കൺസൾട്ടേഷൻ 30 മിനിറ്റിനുള്ളിൽ, {{3}}-ന് (IST) തുടങ്ങും. ചേരാൻ: {{4}} — {{5}} · {{6}} നന്ദി.

## 5. medicine_payment  (1 name, 2 amount in rupees, 3 doctor, 4 pay link, 5 clinic, 6 website)
EN: Hello {{1}}, your medicine payment of ₹{{2}} from {{3}} is ready. Pay with your UPI app here: {{4}} — {{5}} · {{6}} Thank you.
ML: നമസ്കാരം {{1}}, {{3}}-ൽ നിന്നുള്ള നിങ്ങളുടെ മരുന്നിന്റെ തുക ₹{{2}} അടയ്ക്കാൻ തയ്യാറാണ്. UPI ആപ്പ് ഉപയോഗിച്ച് ഇവിടെ അടയ്ക്കുക: {{4}} — {{5}} · {{6}} നന്ദി.

## Switching it on (after the number shows Connected and the templates are Approved)
Helper vars: WA_ENABLED = "true", WA_PHONE_ID = <phone-number id from WhatsApp Manager>. Secret: WA_TOKEN (permanent token of the notifier user).
