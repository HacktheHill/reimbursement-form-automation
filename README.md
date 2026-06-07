# Reimbursement Form Automation

This project automates part of Capital Technology Network’s reimbursement workflow.

It creates bills in QuickBooks Online from Google Form reimbursement submissions, uploads submitted receipts to the bill, posts an approval link to Discord, and uses Cloudflare Workers with Cloudflare Access to record approvals from authorized Signing Authorities.

The approval Worker records signatures and notifies Discord once two unique signatories have signed. It does not currently update the bill status in QuickBooks Online or mark the reimbursement as paid.

## System Overview

The workflow has three main components:

1. **Google Form and Google Apps Script**
   - Receives reimbursement form submissions.
   - Validates submitted form data.
   - Finds or creates the requester as a QuickBooks vendor.
   - Finds the submitted expense account in QuickBooks Online.
   - Finds the submitted QuickBooks class.
   - Creates a QuickBooks bill.
   - Uploads the submitted receipt to the QuickBooks bill.
   - Generates a signed approval URL.
   - Sends the approval request to Discord.

2. **QuickBooks Online**
   - Stores vendors, accounts, classes, bills, and receipt attachments.
   - Acts as the accounting system of record.

3. **Cloudflare Worker and Cloudflare Access**
   - Hosts the approval endpoint.
   - Requires Cloudflare Access authentication.
   - Allows access only to users in the Signing Authorities Google Group.
   - Verifies the approval token.
   - Stores signatures in Cloudflare KV.
   - Sends Discord notifications when signatures are recorded and when a request has two unique signatures.

## Current Production Configuration

| Area | Setting | Value |
|---|---|---|
| Apps Script | Project name | `Reimbursement Form Automation` |
| Apps Script | Script owner / admin account | `admin@ctn-rtc.org` |
| Apps Script | QuickBooks OAuth callback URI | `https://script.google.com/macros/d/172l_2OowjM_igk5at2mdwxP0lJ3X3X-wmPLLFaQvbD1GkKUF6Ax5FO65/usercallback` |
| Apps Script | OAuth token storage | Google Apps Script user properties |
| QuickBooks Online | Environment | Production |
| QuickBooks Online | Company ID / realm ID | `9341452706265932` |
| QuickBooks Online | OAuth scope | `com.intuit.quickbooks.accounting` |
| QuickBooks Online | API base URL | `https://quickbooks.api.intuit.com/v3/company/` |
| Cloudflare Worker | Worker name | `reimbursement-form-automation` |
| Cloudflare Worker | Custom domain | `reimbursement-form-automation.ctn-rtc.org` |
| Cloudflare Worker | Worker URL / preview URL | Disabled |
| Cloudflare Worker | KV binding name | `SIGNATURES` |
| Cloudflare Worker | KV namespace | `reimbursement-quickbooks-integration` |
| Cloudflare Access | Access application name | `reimbursement-form-automation` |
| Cloudflare Access | Protected hostname | `reimbursement-form-automation.ctn-rtc.org` |
| Cloudflare Access | Identity provider | Google Workspace |
| Cloudflare Access | Google Workspace domain | `ctn-rtc.org` |
| Cloudflare Access | Access policy | `Signing Authorities Google Group` |
| Cloudflare Access | Policy action | `ALLOW` |
| Cloudflare Access | Authorized Google Group | `signing-authority@ctn-rtc.org` |
| Cloudflare Access | Instant Auth | Enabled |

## Required Access

Maintainers need access to:

- Google Apps Script project: `Reimbursement Form Automation`
- Google account used by the automation: `admin@ctn-rtc.org`
- CTN QuickBooks Online company
- Intuit Developer app used for this integration
- Cloudflare Worker: `reimbursement-form-automation`
- Cloudflare KV namespace: `reimbursement-quickbooks-integration`
- Cloudflare Access application: `reimbursement-form-automation`
- Google Group: `signing-authority@ctn-rtc.org`
- Discord webhook/channel used for reimbursement notifications

## Secrets and Sensitive Values

Do not commit secrets to the repository.

The following values are sensitive and must not be committed, screenshotted into public documentation, or posted in Discord:

- `QUICKBOOKS_CLIENT_SECRET`
- `SECRET_KEY`
- `DISCORD_WEBHOOK_URL`
- QuickBooks OAuth authorization URLs
- OAuth access tokens
- OAuth refresh tokens
- Cloudflare Access JWTs
- Cloudflare Access meta URLs
- Live reimbursement approval links
- Approval tokens
- Production screenshots showing unredacted secrets

Use placeholders in documentation:

```text
QUICKBOOKS_CLIENT_ID=<stored in Apps Script script properties>
QUICKBOOKS_CLIENT_SECRET=<stored in Apps Script script properties>
QUICKBOOKS_COMPANY_ID=9341452706265932
SECRET_KEY=<same value in Apps Script and Cloudflare Worker>
DISCORD_WEBHOOK_URL=<stored securely>
CLOUDFLARE_URL=https://reimbursement-form-automation.ctn-rtc.org
````

The same `SECRET_KEY` must be configured in both Apps Script and the Cloudflare Worker. Apps Script uses it to generate approval tokens, and the Worker uses it to verify them.

## Google Apps Script Configuration

Set the following script properties in the Apps Script project:

| Property                   | Purpose                                                     | Secret?                            |
| -------------------------- | ----------------------------------------------------------- | ---------------------------------- |
| `CLOUDFLARE_URL`           | Base URL for the Cloudflare Worker approval endpoint        | No                                 |
| `DISCORD_WEBHOOK_URL`      | Discord webhook URL for posting reimbursement notifications | Yes                                |
| `QUICKBOOKS_CLIENT_ID`     | Intuit Developer app client ID                              | No, but avoid unnecessary exposure |
| `QUICKBOOKS_CLIENT_SECRET` | Intuit Developer app client secret                          | Yes                                |
| `QUICKBOOKS_COMPANY_ID`    | QuickBooks company ID / realm ID                            | Internal                           |
| `SECRET_KEY`               | Shared secret used to generate and verify approval tokens   | Yes                                |

Recommended value for `CLOUDFLARE_URL`:

```text
https://reimbursement-form-automation.ctn-rtc.org
```

The Apps Script project must include the Google Workspace Apps Script OAuth2 library.

## QuickBooks Online App Configuration

In the Intuit Developer Portal, configure the QuickBooks app with the Apps Script redirect URI.

The production redirect URI must exactly match the value logged by `logRedirectUri()`:

```text
https://script.google.com/macros/d/172l_2OowjM_igk5at2mdwxP0lJ3X3X-wmPLLFaQvbD1GkKUF6Ax5FO65/usercallback
```

Do not use any of the following as the registered redirect URI:

* A URL containing `code`
* A URL containing `state`
* A URL containing `realmId`
* A `script.google.com/accounts?...continueUrl=...` URL
* A URL from a different Apps Script project
* A URL with an added or removed trailing slash
* A relative URL
* An IP address

The OAuth scope used by the Apps Script project is:

```text
com.intuit.quickbooks.accounting
```

## Authorizing QuickBooks Online

QuickBooks authorization is a manual setup step.

Use this process when setting up the project for the first time, after rotating QuickBooks credentials, or after resetting the OAuth token.

1. Open an incognito/private browser window.
2. Sign in only to `admin@ctn-rtc.org`.
3. Open the Apps Script project.
4. Run `logRedirectUri()`.
5. Confirm that the logged redirect URI exactly matches the redirect URI configured in the Intuit Developer Portal.
6. Run `testAuthorization()`.
7. If authorization is required, open the Apps Script execution logs.
8. Copy the URL logged after:

```text
Open the following URL and grant access:
```

9. Open that URL in the same incognito/private browser session.
10. Complete the QuickBooks authorization flow.
11. Confirm that the callback page says:

```text
Success! You can close this tab.
```

12. Run `testAuthorization()` again.
13. Confirm that the logs say:

```text
Authorization is working correctly.
```

QuickBooks authorization must be completed while signed into `admin@ctn-rtc.org`. The Apps Script currently stores the QuickBooks OAuth token using user properties, so the authorizing Google account matters.

### Google Account Session Issues

If the QuickBooks callback redirects to a Google error page such as:

```text
Sorry, unable to open the file at this time.
```

and the URL contains `authuser=...`, this is usually a Google multi-account session issue.

Fix:

1. Open a new incognito/private browser window.
2. Sign in only to `admin@ctn-rtc.org`.
3. Open the Apps Script project.
4. Run `reset()` if needed.
5. Run `testAuthorization()` again.
6. Use the newly logged authorization URL in the same incognito/private session.

## Form Submission Behaviour

When a reimbursement form is submitted, `onFormSubmit(e)` runs.

The script:

1. Reads the form response.
2. Converts item responses into a response data object.
3. Validates that all submitted fields have values.
4. Finds or creates the vendor in QuickBooks Online.
5. Looks up the submitted expense account in QuickBooks Online.
6. Looks up the submitted class in QuickBooks Online.
7. Creates a bill in QuickBooks Online.
8. Uploads the receipt to the bill.
9. Generates an approval URL.
10. Posts the approval request to Discord.

## QuickBooks Account and Class Requirements

Valid account numbers are determined by QuickBooks Online, not by the Google Form.

The Apps Script queries QuickBooks Online for accounts where:

```sql
AccountType = 'Expense'
```

It then matches the submitted account number against the QuickBooks account `AcctNum`.

This means:

* The submitted account number must exist in QuickBooks Online.
* The submitted account must be an expense account.
* Revenue or income accounts will not be accepted.
* If a submitted account number is not an expense account in QBO, bill creation will fail with:

```text
Account not found: <account number>
```

For example, a `4000` series account may be a revenue or income account and may fail if it is not an expense account.

The submitted class must also exist in QuickBooks Online. If no matching class is found, bill creation will fail with:

```text
Class not found: <class name>
```

## Receipt Upload Requirements

The reimbursement form must provide a Google Drive file ID for the receipt.

The Apps Script uses `DriveApp.getFileById()` to retrieve the uploaded receipt and then uploads it to the QuickBooks bill.

The account running the Apps Script trigger must have access to the submitted receipt file.

If the form returns receipt values as an array of file IDs, confirm that the Apps Script handles that format correctly before enabling multiple receipt uploads.

## Approval URL Format

Apps Script generates an approval URL using:

* `SECRET_KEY`
* QuickBooks bill ID
* Amount
* Account number

The hash input is:

```text
SECRET_KEY + billId + amount + accountNumber
```

The approval URL includes:

```text
token=<hash>
billId=<bill ID>
amount=<amount>
accountNumber=<account number>
```

The token binds the approval link to a specific bill ID, amount, and account number. If any of those URL parameters are changed, the Worker will reject the request as `Invalid token`.

Cloudflare Access provides the user authorization layer. The token prevents URL tampering, but the approval URL should still be treated as sensitive.

Do not share production approval URLs outside the intended approval channel.

## Cloudflare Worker Configuration

The Worker must expose the following environment interface:

```ts
interface Env {
  SECRET_KEY: string;
  DISCORD_WEBHOOK_URL: string;
  SIGNATURES: KVNamespace;
}
```

Required Worker configuration:

| Name                  | Type                 | Purpose                                           |
| --------------------- | -------------------- | ------------------------------------------------- |
| `SECRET_KEY`          | Secret               | Verifies approval tokens                          |
| `DISCORD_WEBHOOK_URL` | Secret               | Sends approval/signature notifications to Discord |
| `SIGNATURES`          | KV namespace binding | Stores signatures by bill ID                      |

The KV binding name must be:

```text
SIGNATURES
```

The KV namespace currently used is:

```text
reimbursement-quickbooks-integration
```

`SECRET_KEY` and `DISCORD_WEBHOOK_URL` should be configured as Worker secrets where possible.

## Cloudflare Worker Domains

The Worker should be available only through the custom domain:

```text
https://reimbursement-form-automation.ctn-rtc.org
```

The workers.dev URL and preview URL should remain disabled for production use.

## Cloudflare Access Configuration

The Worker custom domain must be protected by a Cloudflare Access self-hosted application.

| Setting      | Value                                       |
| ------------ | ------------------------------------------- |
| Application  | `reimbursement-form-automation`             |
| Destination  | `reimbursement-form-automation.ctn-rtc.org` |
| Login method | Google Workspace                            |
| Instant Auth | Enabled                                     |

Instant Auth should be enabled so users do not see an unnecessary identity provider selection screen when only one login method is available.

### Required Access Policy

The application must have an attached Allow policy for the Signing Authorities Google Group.

| Setting       | Value                                                   |
| ------------- | ------------------------------------------------------- |
| Policy name   | `Signing Authorities Google Group`                      |
| Policy action | `ALLOW`                                                 |
| Include rule  | Google Workspace group: `signing-authority@ctn-rtc.org` |

Creating a reusable Access policy is not enough. The reusable policy must be attached to the `reimbursement-form-automation` Access application.

### Verifying the Google Workspace Identity Provider

To verify that Cloudflare can read the correct Google Workspace user and group information:

1. Go to Cloudflare Zero Trust.
2. Go to **Settings** or **Integrations**.
3. Open **Identity providers**.
4. Select the Google Workspace identity provider.
5. Use the provider test feature.
6. Confirm that the returned identity includes the user’s `ctn-rtc.org` email.
7. Confirm that the returned groups include:

```text
signing-authority@ctn-rtc.org
```

### Verifying Application Policy Attachment

To confirm the reusable policy is attached to the application:

1. Go to **Zero Trust**.
2. Go to **Access controls**.
3. Open **Applications**.
4. Open `reimbursement-form-automation`.
5. Open the **Policies** tab.
6. Confirm that `Signing Authorities Google Group` appears in the application policy list.
7. Save the application after making any changes.

### Testing Access Policy Evaluation

Use the application policy tester before testing with live approval links.

1. Go to the `reimbursement-form-automation` Access application.
2. Open the **Policy tester** tab.
3. Test a user who should be authorized.
4. Confirm that the decision is `Allowed`.

If a user is denied, check:

* Whether the reusable policy is attached to the application
* Whether the user is actually in `signing-authority@ctn-rtc.org`
* Whether the Google Workspace IdP test returns the group
* Whether another Block, Exclude, or Require rule is affecting access
* Whether the user is signed into the wrong Google account
* Whether the browser has a stale Cloudflare Access session

As a temporary diagnostic step only, add an Allow rule for the exact user email address. If the exact email rule works but the Google Group rule does not, the problem is group matching or Google Workspace IdP configuration.

## Signature Behaviour

The Worker identifies the signer using the Cloudflare Access header:

```text
Cf-Access-Authenticated-User-Email
```

The Worker stores signatures in KV by QuickBooks bill ID.

Each signature record includes:

```json
{
  "date": "<ISO timestamp>",
  "user": "<authenticated email>"
}
```

The Worker currently counts unique signatories by taking the part of the email before `@`.

Example:

```text
daniel.thorp@ctn-rtc.org -> daniel.thorp
```

This assumes signatories have stable, unique usernames within the organization. If signing authorities may use multiple domains or aliases, review this logic before relying on it for uniqueness.

Once there are at least two unique signatories, the Worker posts a Discord notification saying the reimbursement request is ready for processing.

## Discord Notifications

Discord is used for:

1. Initial reimbursement approval requests
2. Signature notifications
3. Ready-for-processing notifications
4. Error notifications from Apps Script

The Discord webhook URL must not be committed to the repository.

If the Discord webhook is rate-limited, Discord may return HTTP `429`. The automation should log this cleanly and avoid allowing an error-reporting failure to obscure the original error.

## Testing Checklist

### QuickBooks Authorization Test

1. Open an incognito/private window.
2. Sign in only to `admin@ctn-rtc.org`.
3. Run `testAuthorization()` in Apps Script.
4. If needed, open the logged authorization URL.
5. Complete QBO authorization.
6. Run `testAuthorization()` again.
7. Confirm that authorization is working.

### Form Submission Test

Submit a test reimbursement form using:

* A real QBO expense account number
* A real QBO class
* A small test amount
* A test receipt file accessible to the Apps Script trigger account

Expected result:

1. Vendor is found or created in QBO.
2. Expense account is found in QBO.
3. Class is found in QBO.
4. Bill is created in QBO.
5. Receipt is uploaded to the bill.
6. Discord receives an approval request.
7. Approval link points to `reimbursement-form-automation.ctn-rtc.org`.

### Cloudflare Access and Signature Test

1. Confirm the signer is in `signing-authority@ctn-rtc.org`.
2. Open the approval link in a browser.
3. Sign in with the signer’s `ctn-rtc.org` Google account.
4. Confirm the Worker records the signature.
5. Confirm Discord receives a signature notification.

### Two-Signature Test

1. Have one authorized signer open the approval link.
2. Confirm the response says the request is waiting for another unique signature.
3. Have a second authorized signer open the approval link.
4. Confirm the response says the request is ready for processing.
5. Confirm Discord receives the ready-for-processing notification.

## Troubleshooting

### QuickBooks callback opens a Google error page

Symptom:

```text
Sorry, unable to open the file at this time.
```

Likely cause:

Google opened the Apps Script callback using the wrong signed-in account.

Fix:

1. Use incognito/private browsing.
2. Sign in only to `admin@ctn-rtc.org`.
3. Re-run `testAuthorization()`.
4. Open the newly logged authorization URL in the same session.

### `testAuthorization()` does not show a clickable URL

Check the Apps Script execution logs. The authorization URL is logged after:

```text
Open the following URL and grant access:
```

If the helper function returns HTML output, the link may also appear in the Apps Script execution result, depending on how the function is run.

### QuickBooks API calls return HTTP 200, but bill creation fails

If the logs show successful QBO API responses before failure, OAuth is probably working.

Check the actual error.

Example:

```text
Account not found: 4000-10-7-00
```

This means the submitted account number was not found among QBO expense accounts.

### `Account not found`

Cause:

The submitted account number is not a QuickBooks expense account, or the account number does not exist in QBO.

Fix:

1. Confirm the account exists in QuickBooks Online.
2. Confirm the account has `AccountType = Expense`.
3. Submit the form again with a valid expense account number.

### `Class not found`

Cause:

The submitted class does not match a class in QuickBooks Online.

Fix:

1. Confirm the class exists in QBO.
2. Confirm spelling and capitalization.
3. Update the form submission or QBO class as needed.

### Receipt upload fails

Possible causes:

* The receipt value is not a valid Drive file ID.
* The Apps Script trigger account cannot access the uploaded file.
* The form returned the receipt as an array of file IDs and the script expected a single string.
* QuickBooks rejected the upload payload.

Fix:

1. Confirm the uploaded receipt file exists in Google Drive.
2. Confirm the Apps Script trigger account can access it.
3. Check the Apps Script logs for the upload request and response.
4. If needed, update the Apps Script to support multiple receipt file IDs.

### Discord webhook returns HTTP 429

Cause:

Discord rate limiting.

Fix:

1. Wait before retrying.
2. Avoid repeated test submissions in a short time.
3. Configure webhook calls to use `muteHttpExceptions: true`.
4. Log the Discord response rather than throwing during error reporting.

### Cloudflare Access says the user is not permitted

Likely causes:

* The reusable policy is not attached to the Access application.
* The user is not in `signing-authority@ctn-rtc.org`.
* Cloudflare’s Google Workspace IdP is not returning group membership.
* The user signed in with the wrong Google account.
* Another Access policy is blocking or excluding the user.
* The browser has a stale Access session.

Fix:

1. Test the Google Workspace IdP and confirm group membership.
2. Open the Access application.
3. Confirm the `Signing Authorities Google Group` policy is attached.
4. Use the application policy tester for the affected user.
5. Retry in an incognito/private browser window.

### Worker returns `Missing required parameters`

Cause:

The approval URL is missing one or more required query parameters.

Required parameters:

```text
token
billId
amount
accountNumber
```

Fix:

Generate a new approval URL from Apps Script.

### Worker returns `Unauthorized`

Cause:

The request reached the Worker without a valid Cloudflare Access authenticated user email header.

Fix:

1. Confirm the Worker custom domain is protected by Cloudflare Access.
2. Confirm the user signs in through Cloudflare Access.
3. Confirm the app is not being reached through an unprotected workers.dev or preview URL.

### Worker returns `Invalid token`

Cause:

The approval token does not match the expected hash.

Possible reasons:

* `SECRET_KEY` differs between Apps Script and Cloudflare Worker.
* The approval URL was modified.
* `billId`, `amount`, or `accountNumber` changed.
* The URL is from a previous test or stale request.

Fix:

1. Confirm `SECRET_KEY` is the same in Apps Script and Worker.
2. Generate a fresh approval URL.
3. Do not manually edit approval URLs.

## Maintenance

### Updating Signing Authorities

To update who can sign reimbursement requests:

1. Update membership in the Google Group:

```text
signing-authority@ctn-rtc.org
```

2. Confirm Cloudflare’s Google Workspace IdP test returns the updated group membership.
3. Use the Access application policy tester to confirm the user is allowed or denied as expected.

No Worker code change should be required if the Access policy continues to use the Google Group.

### Rotating QuickBooks Credentials

1. Update the client secret in the Intuit Developer Portal if needed.
2. Update `QUICKBOOKS_CLIENT_SECRET` in Apps Script script properties.
3. Run `reset()` in Apps Script.
4. Re-run the QuickBooks authorization process from `admin@ctn-rtc.org`.
5. Test form submission with a known-good expense account.

### Rotating `SECRET_KEY`

The `SECRET_KEY` must match in both Apps Script and the Cloudflare Worker.

To rotate it:

1. Update `SECRET_KEY` in Apps Script script properties.
2. Update `SECRET_KEY` in Cloudflare Worker secrets.
3. Deploy or confirm the Worker configuration.
4. Generate a new test approval URL.
5. Confirm the Worker accepts the new token.

Old approval links generated with the previous `SECRET_KEY` will stop working.

### Rotating the Discord Webhook

1. Create a new Discord webhook.
2. Update `DISCORD_WEBHOOK_URL` in Apps Script script properties.
3. Update `DISCORD_WEBHOOK_URL` in Cloudflare Worker secrets.
4. Send a test reimbursement submission.
5. Confirm Discord receives:

   * Initial approval request
   * Signature notification
   * Ready-for-processing notification

## Local Development

Use `clasp` for Apps Script and `wrangler` for the Cloudflare Worker.

Required deployment checks:

* Apps Script changes must be pushed to the correct script project.
* Worker deployments must preserve the `SIGNATURES` KV binding.
* `SECRET_KEY` and `DISCORD_WEBHOOK_URL` must be configured in the Worker environment.
* The Worker custom domain must remain protected by Cloudflare Access.

Useful commands:

```bash
clasp push
clasp pull
wrangler deploy
wrangler secret put SECRET_KEY
wrangler secret put DISCORD_WEBHOOK_URL
```

## Contributing

For significant changes, document:

* What changed
* Whether Apps Script properties changed
* Whether Worker secrets or bindings changed
* Whether Cloudflare Access policies changed
* Whether QuickBooks app configuration changed
* How the change was tested

Do not include secrets, OAuth URLs, approval links, or unredacted admin screenshots in commits or pull requests.

## License

This project is licensed under the MIT License. See the `LICENSE` file for more information.
