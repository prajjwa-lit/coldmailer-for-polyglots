import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import nodemailer from "nodemailer";
import inquirer from "inquirer";
import { parse } from "csv-parse/sync";
import "dotenv/config";

const CONFIG = {
  fromName: "Prajjwal Tripathi",
  fromEmail: process.env.GMAIL_USER,
  recipientsFile: "recipients.csv",       
  subjectsFile: "subjects.txt",
  templatesDir: "templates",
  resumesDir: "resumes",
  sentLogFile: "sent.log",
  errorLogFile: "error.log",
  msBetweenEmails: 1500,
  maxRetries: 2,
};

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function appendLine(file, line) {
  await fsp.appendFile(file, line + "\n", { encoding: "utf8" });
}

async function readList(file) {
  try {
    const raw = await fsp.readFile(file, "utf8");
    return raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
}

async function listFiles(dir, { exts = null } = {}) {
  try {
    const items = await fsp.readdir(dir, { withFileTypes: true });
    return items
      .filter((d) => d.isFile())
      .map((d) => d.name)
      .filter((name) => {
        if (!exts) return true;
        return exts.includes(path.extname(name).toLowerCase());
      });
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
}

async function loadAlreadySent(file) {
  const sent = new Set();
  const lines = await readList(file);
  for (const line of lines) {
    const parts = line.split("|").map((p) => p.trim());
    if (parts.length >= 2) sent.add(parts[1]);
  }
  return sent;
}

function createTransporter() {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.error("Missing Gmail credentials in .env");
    process.exit(1);
  }
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

// Replace {{placeholders}} in a string using recipient fields
function interpolate(str, recipient) {
  return str.replace(/{{\s*([^}]+)\s*}}/g, (_, key) => {
    return recipient[key] || "";
  });
}

async function askChoices({ recipient, subjects, templates, resumes, defaults }) {
  const subjectChoices = [
    ...subjects.map((s) => ({ name: interpolate(s, recipient), value: s })),
    new inquirer.Separator(),
    { name: "✍️  Enter a custom subject…", value: "__CUSTOM__" },
  ];

  const ans = await inquirer.prompt([
    {
      type: "list",
      name: "subjectPick",
      message: `Subject for ${recipient.email}:`,
      choices: subjectChoices,
      default: 0,
    },
    {
      type: "input",
      name: "subjectCustom",
      message: "Enter custom subject:",
      when: (a) => a.subjectPick === "__CUSTOM__",
      validate: (v) => (v.trim() ? true : "Subject cannot be empty"),
    },
    {
      type: "list",
      name: "template",
      message: `Cover letter template for ${recipient.email}:`,
      choices: templates,
      default: templates[0],
    },
    {
      type: "list",
      name: "resume",
      message: `Resume file for ${recipient.email}:`,
      choices: resumes,
      default: resumes[0],
    },
    {
      type: "confirm",
      name: "applyToAll",
      message: "Apply these choices to all remaining recipients?",
      default: false,
    },
  ]);

  return {
    subject:
      ans.subjectPick === "__CUSTOM__" ? ans.subjectCustom : interpolate(ans.subjectPick, recipient),
    template: ans.template,
    resume: ans.resume,
    applyToAll: ans.applyToAll,
  };
}

async function main() {
  // Check required files
  if (!fs.existsSync(CONFIG.recipientsFile)) {
    console.error(`Missing recipients file: ${CONFIG.recipientsFile}`);
    process.exit(1);
  }

  // Load recipients from CSV
  const raw = await fsp.readFile(CONFIG.recipientsFile);
  const records = parse(raw, { columns: true, skip_empty_lines: true });
  const alreadySent = await loadAlreadySent(CONFIG.sentLogFile);
  const recipients = records.filter((r) => !alreadySent.has(r.email));

  if (recipients.length === 0) {
    console.log("No new recipients to send");
    return;
  }

  const subjects = await readList(CONFIG.subjectsFile);
  const templates = await listFiles(CONFIG.templatesDir, { exts: [".html"] });
  const resumes = await listFiles(CONFIG.resumesDir);

  const transporter = createTransporter();
  let globalSelection = null;

  for (const recipient of recipients) {
    if (!globalSelection) {
      const chosen = await askChoices({
        recipient,
        subjects,
        templates,
        resumes,
        defaults: null,
      });
      if (chosen.applyToAll) globalSelection = chosen;
      else globalSelection = { ...chosen, oneShot: true };
    }

    const { subject, template, resume } = globalSelection;

    // Load template and interpolate placeholders
    const html = interpolate(
      await fsp.readFile(path.join(CONFIG.templatesDir, template), "utf8"),
      recipient
    );

    const resumePath = path.join(CONFIG.resumesDir, resume);
    const attachments = [{ filename: path.basename(resumePath), path: resumePath }];

    // Send with retries
    let attempts = 0,
      sent = false;
    while (attempts <= CONFIG.maxRetries && !sent) {
      attempts++;
      try {
        const info = await transporter.sendMail({
          from: `"${CONFIG.fromName}" <${CONFIG.fromEmail}>`,
          to: recipient.email,
          subject: interpolate(subject, recipient),
          html,
          attachments,
        });

        await appendLine(
          CONFIG.sentLogFile,
          `${new Date().toISOString()} | ${recipient.email} | ${info.messageId}`
        );
        console.log(`✓ Sent to ${recipient.email}`);
        sent = true;
      } catch (err) {
        await appendLine(
          CONFIG.errorLogFile,
          `${new Date().toISOString()} | ${recipient.email} | attempt ${attempts} | ${err.message}`
        );
        console.error(`✗ Failed to ${recipient.email}: ${err.message}`);
        await sleep(1500);
      }
    }

    await sleep(CONFIG.msBetweenEmails);

    if (globalSelection.oneShot) globalSelection = null;
  }
  console.log("All done.");
}

main().catch((err) => console.error(err));
