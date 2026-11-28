# WhatsApp templates for Heal 360 Online Clinic
Create in Meta → WhatsApp Manager → Message templates. Language: English. Header/footer/buttons: none.
Category: **Utility** for all 13. Written so they read as normal appointment/payment messages (no offers, no "book now", no advertising), which is how Meta decides Utility. If Meta still approves one as Marketing, ask for a category review.
A template can't start or end with a variable, so each ends with fixed text.

**Patient messages = ONE message, English first, then Malayalam** (no language choice). The same details appear in both parts, so the numbers
go: English part 1..h, Malayalam part h+1..2h, then the shared lines. Body layout:

    <English paragraph>

    <Malayalam paragraph>

    <shared lines>
    Thank you / നന്ദി.

Example values: name Asha · consultation New consultation · doctor Dr. Seena Naseem K.A. · day Mon, 30 Nov · time 5:30 pm · links https://example.com/room · clinic Heal 360 Online Clinic · website https://www.heal360homoeopathy.com/

## 1. booking_received — Booking request received
Variables: {{1}} name, {{2}} consultation, {{3}} doctor, {{4}} day, {{5}} time (repeated as {{6}}–{{10}} for the Malayalam part) · {{11}} clinic, {{12}} website
```
Hello {{1}}, we have received your booking request for {{2}} with {{3}} on {{4}} at {{5}} (IST). The doctor will confirm it shortly.

നമസ്കാരം {{6}}, {{8}}-യുമായുള്ള {{7}}-നായി {{9}}, {{10}}-ന് (IST) ബുക്ക് ചെയ്ത നിങ്ങളുടെ അഭ്യർത്ഥന ഞങ്ങൾക്ക് ലഭിച്ചു. ഡോക്ടർ ഉടൻ സ്ഥിരീകരിക്കും.

{{11}} · {{12}}
Thank you / നന്ദി.
```

## 2. booking_confirmed — Confirmed by the doctor
Variables: {{1}} name, {{2}} consultation, {{3}} doctor, {{4}} day, {{5}} time (repeated as {{6}}–{{10}} for the Malayalam part) · {{11}} video-room link, {{12}} clinic, {{13}} website
```
Hello {{1}}, your {{2}} with {{3}} is confirmed for {{4}} at {{5}} (IST). At that time, join the video consultation using the link below.

നമസ്കാരം {{6}}, {{8}}-യുമായുള്ള നിങ്ങളുടെ {{7}} {{9}}, {{10}}-ന് (IST) സ്ഥിരീകരിച്ചു. ആ സമയത്ത് താഴെയുള്ള ലിങ്ക് തുറന്ന് വീഡിയോ കൺസൾട്ടേഷനിൽ ചേരുക.

{{11}}
{{12}} · {{13}}
Thank you / നന്ദി.
```

## 3. reminder_24h — The day before
Variables: {{1}} name, {{2}} doctor, {{3}} day, {{4}} time (repeated as {{5}}–{{8}} for the Malayalam part) · {{9}} video-room link, {{10}} clinic, {{11}} website
```
Hello {{1}}, a reminder: your consultation with {{2}} is tomorrow, {{3}} at {{4}} (IST). Join using the link below.

നമസ്കാരം {{5}}, ഓർമ്മപ്പെടുത്തൽ: {{6}}-യുമായുള്ള നിങ്ങളുടെ കൺസൾട്ടേഷൻ നാളെ, {{7}}, {{8}}-ന് (IST) ആണ്. താഴെയുള്ള ലിങ്ക് വഴി ചേരുക.

{{9}}
{{10}} · {{11}}
Thank you / നന്ദി.
```

## 4. reminder_30m — 30 minutes before
Variables: {{1}} name, {{2}} doctor, {{3}} time (repeated as {{4}}–{{6}} for the Malayalam part) · {{7}} video-room link, {{8}} clinic, {{9}} website
```
Hello {{1}}, your consultation with {{2}} starts in 30 minutes, at {{3}} (IST). Join using the link below.

നമസ്കാരം {{4}}, {{5}}-യുമായുള്ള നിങ്ങളുടെ കൺസൾട്ടേഷൻ 30 മിനിറ്റിനുള്ളിൽ, {{6}}-ന് (IST) തുടങ്ങും. താഴെയുള്ള ലിങ്ക് വഴി ചേരുക.

{{7}}
{{8}} · {{9}}
Thank you / നന്ദി.
```

## 5. booking_cancelled — Declined or cancelled by the clinic
Variables: {{1}} name, {{2}} consultation, {{3}} doctor, {{4}} day, {{5}} time (repeated as {{6}}–{{10}} for the Malayalam part) · {{11}} booking link, {{12}} clinic, {{13}} website
```
Hello {{1}}, sorry — your {{2}} with {{3}} on {{4}} at {{5}} (IST) could not go ahead. If you paid by UPI, the clinic will refund you. You can choose another time using the link below.

നമസ്കാരം {{6}}, ക്ഷമിക്കണം — {{8}}-യുമായുള്ള നിങ്ങളുടെ {{7}} {{9}}, {{10}}-ന് (IST) നടക്കാൻ സാധിക്കില്ല. UPI വഴി പണമടച്ചിട്ടുണ്ടെങ്കിൽ ക്ലിനിക്ക് തുക തിരികെ നൽകും. മറ്റൊരു സമയം താഴെയുള്ള ലിങ്കിൽ തിരഞ്ഞെടുക്കാം.

{{11}}
{{12}} · {{13}}
Thank you / നന്ദി.
```

## 6. medicine_payment — Medicine payment link (patient only)
Variables: {{1}} name, {{2}} amount, {{3}} doctor (repeated as {{4}}–{{6}} for the Malayalam part) · {{7}} pay link, {{8}} clinic, {{9}} website
```
Hello {{1}}, your medicine payment of ₹{{2}} from {{3}} is ready. Please pay with your UPI app using the link below.

നമസ്കാരം {{4}}, {{6}}-ൽ നിന്നുള്ള നിങ്ങളുടെ മരുന്നിന്റെ തുക ₹{{5}} അടയ്ക്കാൻ തയ്യാറാണ്. താഴെയുള്ള ലിങ്ക് വഴി UPI ആപ്പ് ഉപയോഗിച്ച് അടയ്ക്കുക.

{{7}}
{{8}} · {{9}}
Thank you / നന്ദി.
```

## 7. follow_up — Follow-up (only when the doctor adds a date; sent 3 days before it, 10:00)
Variables: {{1}} name, {{2}} doctor, {{3}} follow-up date, {{4}} consultation date (repeated as {{5}}–{{8}} for the Malayalam part) · {{9}} booking link, {{10}} clinic, {{11}} website
```
Hello {{1}}, {{2}} has set your follow-up review for {{3}}, when the medicine course from your consultation on {{4}} is due to finish. You can choose your time using the link below.

നമസ്കാരം {{5}}, {{8}}-ലെ കൺസൾട്ടേഷനിൽ നൽകിയ മരുന്ന് കഴിയുന്ന സമയത്തോടടുത്ത്, {{7}}-ന് {{6}} നിങ്ങളുടെ ഫോളോ-അപ്പ് പരിശോധന നിശ്ചയിച്ചിട്ടുണ്ട്. താഴെയുള്ള ലിങ്കിൽ സമയം തിരഞ്ഞെടുക്കാം.

{{9}}
{{10}} · {{11}}
Thank you / നന്ദി.
```

# Messages to the DOCTOR (wording below is exactly as approved by Meta on 28 Nov 2026; English only; sent to the doctor's own WhatsApp number in DOCTORS_JSON). Category Utility.

## D1. doctor_new_request  (1 doctor, 2 patient, 3 consultation, 4 day, 5 time, 6 dashboard link, 7 clinic, 8 website)
Hello {{1}}, new booking request from {{2}} for {{3}} on {{4}} at {{5}} (IST). Please check the UPI payment, then confirm or decline here: {{6}} — {{7}} · {{8}} Thank you.

## D2. doctor_patient_cancelled  (1 doctor, 2 patient, 3 day, 4 time, 5 dashboard, 6 clinic, 7 website)
Hello {{1}}, {{2}} cancelled the appointment on {{3}} at {{4}} (IST). The time is free again. Dashboard: {{5}} — {{6}} · {{7}} Thank you.

## D3. doctor_time_changed  (1 doctor, 2 patient, 3 day, 4 time, 5 dashboard, 6 clinic, 7 website)
Hello {{1}}, your patient {{2}} has moved their appointment to a new time: {{3}} at {{4}} (IST). You can see the updated schedule on your clinic dashboard here: {{5}} — {{6}} · {{7}} Thank you.

## D4. doctor_reminder_24h  (1 doctor, 2 patient, 3 day, 4 time, 5 start-call link, 6 clinic, 7 website)
Hello {{1}}, this is a reminder that you have a consultation with your patient {{2}} tomorrow, {{3}} at {{4}} (IST). You can start the video call from this link when it is time: {{5}} — {{6}} · {{7}} Thank you.

## D5. doctor_reminder_30m  (1 doctor, 2 patient, 3 time, 4 start-call link, 5 clinic, 6 website)
Hello {{1}}, your consultation with your patient {{2}} will start in 30 minutes, at {{3}} (IST). You can start the video call from this link when you are ready: {{4}} — {{5}} · {{6}} Thank you.

## D6. doctor_medicine_paid  (1 doctor, 2 patient, 3 amount, 4 reference text, 5 dashboard, 6 clinic, 7 website) — the "paid" confirmation to the doctor
Hello {{1}}, your patient {{2}} says they have paid ₹{{3}} for medicines ({{4}}). Please check your UPI app, then tap Mark paid in your clinic dashboard here: {{5}} — {{6}} · {{7}} Thank you.

## Switching it on (after the number shows Connected and the templates are Approved)
Add each doctor's own WhatsApp number to DOCTORS_JSON ("whatsapp"), or her messages are skipped.
Helper vars: WA_ENABLED = "true", WA_PHONE_ID = <phone-number id from WhatsApp Manager>. Secret: WA_TOKEN (permanent token of the notifier user).
