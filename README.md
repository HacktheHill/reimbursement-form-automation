# Hack the Hill Reimbursement Form Integration with QuickBooks Online

This Google Apps Script automates the creation of bills on QuickBooks Online from form submissions on the Hack the Hill reimbursement form. When a form is submitted, the script processes the data, creates a bill, and uploads the receipt to QuickBooks Online.

## Prerequisites

1. Ensure you have access to the Google Apps Script project associated with the Hack the Hill reimbursement form.
2. Ensure you have the necessary QuickBooks Online API credentials (`Client ID`, `Client Secret`, and `Company ID`).
3. Add the [OAuth2 library](https://github.com/googleworkspace/apps-script-oauth2) to your Google Apps Script project.

## Configuration

1. Set the following script properties in your Google Apps Script project:
   - `QUICKBOOKS_CLIENT_ID`
   - `QUICKBOOKS_CLIENT_SECRET`
   - `QUICKBOOKS_COMPANY_ID`

2. Set the OAuth2 callback URL in your QuickBooks app settings. The callback URL should be in the format `https://script.google.com/macros/d/{SCRIPT_ID}/usercallback`, where `{SCRIPT_ID}` is your Google Apps Script project ID.

## Usage

1. **Authorization**: Ensure that the OAuth2 authorization flow is completed. You may need to run `logRedirectUri()` to get the redirect URI and complete the OAuth2 setup.
2. **Form Submission**: When a form submission occurs, the `onFormSubmit(e)` function is triggered, processing the data and interacting with QuickBooks Online to create a bill and upload the receipt.

## Development

This project uses the [Google Apps Script](https://developers.google.com/apps-script) platform for development. You can use the [Apps Script IDE](https://script.google.com) to edit and run the script.

You can also use the [clasp](https://developers.google.com/apps-script/guides/clasp) command-line tool to develop the script locally. To get started, run the following commands:

```bash
npm install -g @google/clasp
clasp login
clasp clone <SCRIPT_ID>
```

You can then edit the script files locally and push changes to the Apps Script project using `clasp push` (or `clasp push --watch` to automatically push changes as you save files) and pull changes using `clasp pull`.

## Contributing

Contributions are welcome! For major changes, please open an issue first to discuss what you would like to change.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more information.
