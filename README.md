# Bulk Job Application Mailer (Nodemailer + Gmail App Password)

Send personalized job application emails in bulk using **Node.js**, **Nodemailer**, and a **Gmail App Password**.
Choose a **resume**, **HTML cover letter template**, and **subject** per recipient (with an option to apply the same selection to everyone).
Supports **CSV personalization** with placeholders like `{{name}}` and `{{company}}`.

---

## ✨ Features

- 📧 Bulk sending via Gmail (App Password required)
- 🧩 Per-recipient interactive selection:
  - Subject (from a list or custom)
  - HTML cover letter template
  - Resume file (PDF or other)
- 🧠 Personalization: use `{{name}}`, `{{company}}`, etc. from CSV in **subjects** and **templates**
- 🔁 “Apply to all remaining recipients” to avoid repeated prompting
- 🧾 Idempotent: skips recipients already sent (tracked in `sent.log`)
- 🪵 Logging: `sent.log` (successes), `error.log` (failures)
- ⏳ Delay & retry to reduce rate-limit issues

---

## 🧱 Project Structure

.
├── index.js
├── package.json
├── .env.example
├── .gitignore
├── recipients.example.csv
├── subjects.example.txt
├── templates/
│   ├── example-cover.html
│   └── .gitkeep
└── resumes/
└── .gitkeep



---

## 🔐 Prerequisites

- **Node.js** 18+ (works with 20/22/23)
- A **Gmail** account with **2‑Step Verification** enabled
- A **Gmail App Password** for Mail (see below)

### Create a Gmail App Password
1. Turn on 2‑Step Verification in your Google Account.
2. Go to **App Passwords**: https://myaccount.google.com/apppasswords
3. For "App", select **Mail**. For "Device", select **Other (Custom name)** and name it anything (e.g., `JobMailer`).
4. Copy the 16‑character password (without spaces).

---

## 🚀 Setup

1.  **Clone & Install Dependencies**
    ```bash
    git clone <repository-url>
    cd <repository-name>
    npm install
    ```
    > **Note**: This project uses ES Modules. Ensure your `package.json` contains `"type": "module"`.

2.  **Configure Environment**
    Create a `.env` file by copying the example.
    ```bash
    cp .env.example .env
    ```
    Edit `.env` and add your credentials:
    ```env
    GMAIL_USER=your-email@gmail.com
    GMAIL_APP_PASSWORD=abcdefghijklmnop
    ```


---

## 🧾 File Formats

#### `recipients.csv`
A CSV file with headers. The `email`, `name`, and `company` columns are recommended, but any column can be used as a placeholder in templates.

```csv
email,name,company
alice@example.com,Alice Johnson,Acme Inc.
hr@contoso.com,HR Team,Contoso Ltd.
subjects.txt
A plain text file where each line is a potential subject. Blank lines and lines starting with # are ignored.

Application for Frontend Engineer at {{company}}
Excited to join {{company}} as a Software Developer
HTML Templates (in templates/)
Standard HTML files. Use placeholders like {{name}} which will be replaced with data from recipients.csv.

HTML

<!doctype html>
<html>
  <body>
    <p>Dear {{name}},</p>
    <p>I’m excited about the opportunity at {{company}}...</p>
    <p>Regards,<br/>Your Name<br/>your-email@gmail.com</p>
  </body>
</html>
▶️ Run
Execute the script from your terminal:

Bash

node index.js
The script will prompt you for each recipient to:

Select a Subject (from subjects.txt or a custom one).

Choose a Cover Letter Template (from templates/).

Select a Resume (from resumes/).

You will also have an option to apply your selections to all subsequent recipients to speed up the process.

Idempotency: The script logs successfully sent emails in sent.log. If you run the script again, it will automatically skip these already-processed recipients.

🧪 Quick Start with Examples
To test the script quickly, use the provided example files.

Copy examples to create your local files:

Bash

cp .env.example .env
cp recipients.example.csv recipients.csv
cp subjects.example.txt subjects.txt
Edit .env with your actual Gmail user and App Password.

Add at least one real template to templates/ and one resume to resumes/.

Run the script:

Bash

node index.js
🧰 Troubleshooting
Invalid login: 535-5.7.8: This means authentication failed. Ensure you are using a Gmail App Password, not your regular account password. Also, verify that GMAIL_USER in your .env file is the correct email address associated with the App Password.

ESM import error (“Cannot use import statement outside a module”): Make sure your package.json includes the line "type": "module". If not, you must convert import statements to require().

Subjects list not appearing: Check that subjects.txt exists in the same directory as index.js, contains one subject per line, and is saved with standard UTF-8 encoding.

Gmail Sending Limits: A standard consumer Gmail account can send approximately 100-500 emails per 24-hour period. If you hit this limit, you may be temporarily blocked. For sending larger volumes, consider using a dedicated email service like Amazon SES or SendGrid.