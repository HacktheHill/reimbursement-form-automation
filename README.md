# Hack the Hill Reimbursement Form Automation

This project automates the creation of bills on QuickBooks Online from form submissions on the Hack the Hill reimbursement form. The project uses Google Apps Script for initial form processing and Cloudflare Workers for handling signature verification and finalization of reimbursements, protected with Cloudflare Zero Trust Access.

## Prerequisites

1. **Google Apps Script**:
   - Ensure you have access to the Google Apps Script project associated with the Hack the Hill reimbursement form.
   - Ensure you have the necessary QuickBooks Online API credentials (`Client ID`, `Client Secret`, and `Company ID`).
   - Add the [OAuth2 library](https://github.com/googleworkspace/apps-script-oauth2) to your Google Apps Script project.

2. **Cloudflare Workers**:
   - Ensure you have access to the Cloudflare Workers environment.
   - Set up a Cloudflare KV namespace for logging signatures.
   - Set up Cloudflare Zero Trust Access to protect your Worker endpoint.
   - Use a custom domain to protect the Worker with Access.
   - Set up a Google Workspace Authentication Provider for Cloudflare Zero Trust Access and use a Google Group containing your Signing Authorities. Follow the steps to set up Google Workspace in the Google Cloud Platform Console and Google Admin console [here](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/gsuite/).
   - Enable "Instant Auth" to avoid the extra screen.

## Configuration

### Google Apps Script

1. Set the following script properties in your Google Apps Script project:
   - `QUICKBOOKS_CLIENT_ID`
   - `QUICKBOOKS_CLIENT_SECRET`
   - `QUICKBOOKS_COMPANY_ID`
   - `SECRET_KEY` (a secret key for generating tokens)
   - `DISCORD_WEBHOOK_URL` (URL of the Discord webhook)
   - `CLOUDFLARE_URL` (URL of the Cloudflare Worker on the custom domain)

2. Set the OAuth2 callback URL in your QuickBooks app settings. The callback URL should be in the format `https://script.google.com/macros/d/{SCRIPT_ID}/usercallback`, where `{SCRIPT_ID}` is your Google Apps Script project ID.

### Cloudflare Workers

1. Set the following environment variables in your Cloudflare Worker:
   - `SECRET_KEY`
   - `DISCORD_WEBHOOK_URL`

## Usage

### Google Apps Script

1. **Authorization**: Ensure that the OAuth2 authorization flow is completed. You may need to run `logRedirectUri()` to get the redirect URI and complete the OAuth2 setup.
2. **Form Submission**: When a form submission occurs, the `onFormSubmit(e)` function is triggered, processing the data and interacting with QuickBooks Online to create a bill and upload the receipt.
3. **Initial Signature Logging**: The initial signature logging is initiated via a link sent to Discord.

### Cloudflare Workers

1. **Signature Verification**: Authorized users will need to sign the reimbursement request via a link sent to Discord. The request will be finalized only after two unique signatures are recorded.
2. **Finalization**: The Cloudflare Worker handles the verification of signatures and finalizes the reimbursement process once the conditions are met.

## Development

### Google Apps Script

This project uses the [Google Apps Script](https://developers.google.com/apps-script) platform for development. You can use the [Apps Script IDE](https://script.google.com) to edit and run the script.

You can also use the [clasp](https://developers.google.com/apps-script/guides/clasp) command-line tool to develop the script locally. To get started, run the following commands:

```bash
npm install -g @google/clasp
clasp login
clasp clone <SCRIPT_ID>
```

You can then edit the script files locally and push changes to the Apps Script project using `clasp push` (or `clasp push --watch` to automatically push changes as you save files) and pull changes using `clasp pull`.

### Cloudflare Workers

This project uses the [Cloudflare Workers](https://developers.cloudflare.com/workers) platform for handling signature verification and finalization. You can use the [Wrangler CLI](https://developers.cloudflare.com/workers/cli-wrangler) to manage and deploy your Worker.

To get started, run the following commands:

```bash
npm install -g @cloudflare/wrangler
wrangler login
wrangler init reimbursement-form-automation
```

You can then edit the script files locally and deploy changes to your Worker using `wrangler publish`.

## Contributing

Contributions are welcome! For major changes, please open an issue first to discuss what you would like to change.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more information.
