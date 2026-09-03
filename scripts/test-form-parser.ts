/**
 * Test script for form-parser.ts
 * Tests HTML parsing against real KAIST Google Forms (no LLM mapping).
 */

import { extractFormFields, extractFormId } from "./form-parser.js";

const TEST_URLS = [
  {
    name: "AX학과 설명회 (closed form, short URL)",
    url: "https://forms.gle/RXN8WAPbc7GfngAz5",
  },
  {
    name: "기후테크 시리즈 (open form, short URL)",
    url: "https://forms.gle/4EWwAYzHr6KGTnTE7",
  },
  {
    name: "미래전략 설명회 (open form, full URL)",
    url: "https://docs.google.com/forms/d/e/1FAIpQLSd6eQW91lIA_Y7HGYvAa-VvHqLxWFV6SV0DOQN_fCfvMQ8A4Q/viewform",
  },
];

async function main() {
  let passed = 0;
  let failed = 0;

  for (const { name, url } of TEST_URLS) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Form: ${name}`);
    console.log(`URL:  ${url}`);
    console.log(`Form ID: ${extractFormId(url)}`);
    console.log("=".repeat(60));

    try {
      const fields = await extractFormFields(url);
      if (fields.length === 0) {
        if (name.includes("closed")) {
          console.log("  [OK] No fields (form is closed -- expected)");
          passed++;
        } else {
          console.log("  [FAIL] No fields extracted!");
          failed++;
        }
      } else {
        console.log(`  [OK] Extracted ${fields.length} field(s):`);
        for (const f of fields) {
          console.log(`    - ${f.entryId}: "${f.label}"`);
        }
        passed++;
      }
    } catch (err) {
      if (name.includes("closed")) {
        console.log(`  [OK] Error expected for closed form: ${err}`);
        passed++;
      } else {
        console.log(`  [ERROR] ${err}`);
        failed++;
      }
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log("=".repeat(60));

  if (failed > 0) process.exit(1);
}

main();
