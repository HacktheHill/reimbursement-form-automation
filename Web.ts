function doGet(e: GoogleAppsScript.Events.DoGet) {
	const token = e.parameter.token;
	const billId = e.parameter.billId;
	const amount = e.parameter.amount;
	const accountNumber = e.parameter.accountNumber;
	const user = Session.getActiveUser().getEmail();

	if (!user) {
		const authUrl = ScriptApp.getAuthorizationInfo(
			ScriptApp.AuthMode.FULL,
		).getAuthorizationUrl();
		return HtmlService.createHtmlOutput(
			'<a href="' + authUrl + '">Sign in with Google</a>',
		);
	}

	if (!isAuthorizedUser(user)) {
		return HtmlService.createHtmlOutput(
			"You are not authorized to sign this reimbursement.",
		);
	}

	const sheet = SpreadsheetApp.openById(
		getEnv("SIGNATURES_SHEET_ID"),
	).getSheetByName("Signatures");
	if (!sheet) {
		return HtmlService.createHtmlOutput("Signatures sheet not found.");
	}

	const secretKey = getEnv("SECRET_KEY");
	const expectedHash = Utilities.computeDigest(
		Utilities.DigestAlgorithm.SHA_256,
		secretKey + billId + amount + accountNumber,
	)
		.map(byte => (byte + 256).toString(16).slice(-2))
		.join("");

	if (token === expectedHash) {
		logSignature(sheet, billId, user);

		const data = sheet.getDataRange().getValues();
		const signatures = data.filter(
			(row: any[]) => row[0].toString() === billId.toString(),
		);

		const uniqueSignatories = Array.from(
			new Set(signatures.map((row: any[]) => row[1])),
		);

		if (uniqueSignatories.length >= 2) {
			sendDiscordWebhook({
				content: `Reimbursement request #${billId} is ready for processing. [View in QuickBooks](https://qbo.intuit.com/app/bill?&txnId=${billId})`,
			});
			return HtmlService.createHtmlOutput(
				`Reimbursement request #${billId} has been signed by both ${uniqueSignatories.join(
					" and ",
				)} and is ready for processing. <a href="https://qbo.intuit.com/app/bill?&txnId=${billId}" target="_blank">View in QuickBooks</a>`,
			);
		} else {
			return HtmlService.createHtmlOutput(
				`Reimbursement request #${billId} signed. Waiting for another unique signature.`,
			);
		}
	} else {
		return HtmlService.createHtmlOutput("Invalid token.");
	}
}

function isAuthorizedUser(email: string) {
	const authorizedEmails = getEnv("AUTHORIZED_EMAILS").split(",");
	return authorizedEmails.includes(email);
}

function logSignature(
	sheet: GoogleAppsScript.Spreadsheet.Sheet,
	billId: string,
	user: string,
) {
	sheet.appendRow([billId, user, new Date()]);
	sendDiscordWebhook({
		content: `Reimbursement request #${billId} has been signed by ${user}.`,
	});
}

function getSignatures(
	sheet: GoogleAppsScript.Spreadsheet.Sheet,
	billId: string,
) {
	const data = sheet.getDataRange().getValues();
	return data.filter((row: any[]) => row[0] === billId);
}

function checkUniqueSignatures(
	sheet: GoogleAppsScript.Spreadsheet.Sheet,
	billId: string,
) {
	const data = sheet.getDataRange().getValues();
	const signatures = data.filter(
		(row: any[]) => row[0].toString() === billId.toString(),
	);

	const uniqueSignatories = Array.from(
		new Set(signatures.map((row: any[]) => row[1])),
	);

	return uniqueSignatories.length >= 2;
}
