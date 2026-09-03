/**
 * Test script for form-parser.ts
 * Tests HTML parsing against real KAIST Google Forms (no LLM mapping).
 */

import { extractFormFields, extractFormId } from "./form-parser.js";

const TEST_URLS = [
  {
    name: "AX학과 설명회",
    url: "https://forms.gle/RXN8WAPbc7GfngAz5",
  },
  {
    name: "기후테크 시리즈",
    url: "https://forms.gle/4EWwAYzHr6KGTnTE7",
  },
  {
    name: "미래전략 설명회",
    url: "https://docs.google.com/forms/d/e/1FAIpQLSd6eQW91lIA_Y7HGYvAa-VvHqLxWFV6SV0DOQN_fCfvMQ8A4Q/viewform",
  },
];

async function main() {
  for (const { name, url } of TEST_URLS) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Form: ${name}`);
    console.log(`URL:  ${url}`);
    console.log(`Form ID: ${extractFormId(url)}`);
    console.log("=".repeat(60));

    try {
      const fields = await extractFormFields(url);
      if (fields.length === 0) {
        console.log("  [FAIL] No fields extracted!");
      } else {
        console.log(`  [OK] Extracted ${fields.length} field(s):`);
        for (const f of fields) {
          console.log(`    - ${f.entryId}: "${f.label}"`);
        }
      }
    } catch (err) {
      console.log(`  [ERROR] ${err}`);
    }
  }
}

main();
