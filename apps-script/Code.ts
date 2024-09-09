declare const OAuth2: any;

const BASE_URL = "https://quickbooks.api.intuit.com/v3/company/";
const API_SCOPE = "com.intuit.quickbooks.accounting";

// Define necessary types for responses from the QuickBooks API
type VendorQueryResponse = {
	QueryResponse: {
		startPosition: number;
		Vendor: {
			BillAddr: {
				Id: string;
				Line1: string;
				City: string;
				Country: string;
				CountrySubDivisionCode: string;
				PostalCode: string;
			};
			Balance: number;
			Vendor1099: boolean;
			CurrencyRef: {
				value: string;
				name: string;
			};
			domain: string;
			sparse: boolean;
			Id: string;
			SyncToken: string;
			MetaData: {
				CreateTime: string;
				LastUpdatedTime: string;
			};
			GivenName: string;
			FamilyName: string;
			DisplayName: string;
			PrintOnCheckName: string;
			Active: boolean;
			PrimaryPhone: {
				FreeFormNumber: string;
			};
			PrimaryEmailAddr: {
				Address: string;
			};
		}[];
		maxResults: number;
	};
	time: string;
};

type AccountQueryResponse = {
	QueryResponse: {
		startPosition: number;
		Account: {
			Name: string;
			SubAccount: boolean;
			FullyQualifiedName: string;
			Active: boolean;
			Classification: string;
			AccountType: string;
			AccountSubType: string;
			AcctNum: string;
			CurrentBalance: number;
			CurrentBalanceWithSubAccounts: number;
			CurrencyRef: {
				value: string;
				name: string;
			};
			domain: string;
			sparse: boolean;
			Id: string;
			SyncToken: string;
			MetaData: {
				CreateTime: string;
				LastUpdatedTime: string;
			};
		}[];
		maxResults: number;
	};
	time: string;
};

type ClassQueryResponse = {
	QueryResponse: {
		startPosition: number;
		Class: {
			Name: string;
			SubClass: boolean;
			FullyQualifiedName: string;
			Active: boolean;
			domain: string;
			sparse: boolean;
			Id: string;
			SyncToken: string;
			MetaData: {
				CreateTime: string;
				LastUpdatedTime: string;
			};
		}[];
		maxResults: number;
	};
	time: string;
};

type BillQueryResponse = {
	QueryResponse: {
		startPosition: number;
		Bill: {
			SalesTermRef: {
				value: string;
			};
			DueDate: string;
			Balance: number;
			domain: string;
			sparse: boolean;
			Id: string;
			SyncToken: string;
			MetaData: {
				CreateTime: string;
				LastUpdatedTime: string;
			};
			DocNumber: string;
			TxnDate: string;
			CurrencyRef: {
				value: string;
				name: string;
			};
			Line: {
				Id: string;
				LineNum: number;
				Description: string;
				Amount: number;
				DetailType: string;
				AccountBasedExpenseLineDetail: {
					ClassRef: {
						value: string;
						name: string;
					};
					AccountRef: {
						value: string;
						name: string;
					};
					BillableStatus: string;
					TaxCodeRef: {
						value: string;
					};
				};
			}[];
			VendorRef: {
				value: string;
				name: string;
			};
			APAccountRef: {
				value: string;
				name: string;
			};
			TotalAmt: number;
			GlobalTaxCalculation: string;
		}[];
		maxResults: number;
	};
	time: string;
};

type ResponseData = {
	"Full Name": string;
	"Email Address": string;
	Amount: string;
	Description: string;
	"Account Number": string;
	Class: string;
	"Transaction Date": string;
	Receipt: string;
};

function onFormSubmit(e: GoogleAppsScript.Events.FormsOnFormSubmit) {
	if (!e) {
		throw new Error("No event object provided");
	}

	// Get the new form submission
	const formResponse = e.response;
	const itemResponses = formResponse.getItemResponses();

	// Create a dictionary of the form responses
	const responseData = itemResponses.reduce((acc, item) => {
		acc[item.getItem().getTitle()] = item.getResponse();
		return acc;
	}, {} as Record<string, string | string[] | string[][]>);

	// Check if the form submission is valid
	if (!isValidResponseData(responseData)) {
		throw new Error("Invalid form submission");
	}

	try {
		const bill = createBill(responseData);
		sendDiscordWebhook(prepareWebhookPayload(responseData, bill.Bill.Id));
	} catch (err) {
		logError(err as Error, `Error in onFormSubmit`, { responseData });
		// Send a Discord webhook with the error message
		sendDiscordWebhook({
			content: `Error: ${err instanceof Error ? err.message : err}`,
		});
	}
}

//#region Helpers

function getVendor(responseData: ResponseData) {
	try {
		// Query the QuickBooks API to find the vendor
		const vendorQuery = `SELECT * FROM Vendor WHERE DisplayName = '${responseData["Full Name"]}'`;
		const VendorQueryResponse = fetchJSON(
			`${BASE_URL}${getEnv(
				"QUICKBOOKS_COMPANY_ID",
			)}/query?query=${encodeURIComponent(vendorQuery)}`,
			{ method: "get" },
		) as VendorQueryResponse;

		const vendors = VendorQueryResponse.QueryResponse.Vendor ?? [];

		// Create the vendor if it doesn't exist
		if (vendors.length === 0) {
			const newVendor = fetchJSON(
				`${BASE_URL}${getEnv("QUICKBOOKS_COMPANY_ID")}/vendor`,
				{
					method: "post",
					contentType: "application/json",
					payload: JSON.stringify({
						PrimaryEmailAddr: {
							Address: responseData["Email Address"],
						},
						DisplayName: responseData["Full Name"],
					}),
				},
			).Vendor;
			Logger.log(`Vendor created: ${responseData["Full Name"]}`);
			return newVendor;
		} else if (vendors.length > 1) {
			throw new Error(
				`Multiple vendors found for name: ${responseData["Full Name"]}`,
			);
		} else {
			Logger.log(`Vendor found: ${responseData["Full Name"]}`);
			return vendors[0];
		}
	} catch (err) {
		logError(err as Error, "Error fetching/creating vendor", {
			responseData,
		});
		throw err;
	}
}

function getAccount(responseData: ResponseData) {
	try {
		// Query the QuickBooks API to get the account
		const accountQuery = `SELECT * FROM Account WHERE AccountType = 'Expense'`;
		const accountQueryResponse = fetchJSON(
			`${BASE_URL}${getEnv(
				"QUICKBOOKS_COMPANY_ID",
			)}/query?query=${encodeURIComponent(accountQuery)}`,
			{ method: "get" },
		) as AccountQueryResponse;

		// Filter the accounts by account number
		const accounts =
			accountQueryResponse.QueryResponse.Account.filter(
				account => account.AcctNum === responseData["Account Number"],
			) ?? [];

		// Throw an error if no account is found or multiple accounts are found
		if (accounts.length === 0) {
			throw new Error(
				`Account not found: ${responseData["Account Number"]}`,
			);
		} else if (accounts.length > 1) {
			throw new Error(
				`Multiple accounts found: ${responseData["Account Number"]}`,
			);
		}

		Logger.log(`Account found: ${responseData["Account Number"]}`);
		return accounts[0];
	} catch (err) {
		logError(err as Error, "Error fetching account", { responseData });
		throw err;
	}
}

function getClass(responseData: ResponseData) {
	try {
		// Query the QuickBooks API to get the class
		const classQuery = `SELECT * FROM Class WHERE Name = '${responseData["Class"]}'`;
		const ClassQueryResponse = fetchJSON(
			`${BASE_URL}${getEnv(
				"QUICKBOOKS_COMPANY_ID",
			)}/query?query=${encodeURIComponent(classQuery)}`,
			{ method: "get" },
		) as ClassQueryResponse;

		const classes = ClassQueryResponse.QueryResponse.Class ?? [];

		// Throw an error if no class is found or multiple classes are found
		if (classes.length === 0) {
			throw new Error(`Class not found: ${responseData["Class"]}`);
		} else if (classes.length > 1) {
			throw new Error(`Multiple classes found: ${responseData["Class"]}`);
		}

		Logger.log(`Class found: ${responseData["Class"]}`);
		return classes[0];
	} catch (err) {
		logError(err as Error, "Error fetching class", { responseData });
		throw err;
	}
}

function getNextBillNumber() {
	try {
		// Query the QuickBooks API to get all the bill numbers
		const billQuery = `SELECT DocNumber FROM Bill`;
		const billQueryResponse = fetchJSON(
			`${BASE_URL}${getEnv(
				"QUICKBOOKS_COMPANY_ID",
			)}/query?query=${encodeURIComponent(billQuery)}`,
			{ method: "get" },
		) as BillQueryResponse;

		const bills = billQueryResponse.QueryResponse.Bill ?? [];

		// If there are no bills, start with a default number
		if (bills.length === 0) {
			return 1;
		}

		// Extract and sort the DocNumbers as integers
		const sortedBillNumbers = bills
			.map((bill: { DocNumber: string }) => parseInt(bill.DocNumber, 10))
			.filter((num: number) => !isNaN(num))
			.sort((a: number, b: number) => b - a);

		// Get the latest bill number and increment it
		const latestBillNumber = sortedBillNumbers[0];
		return latestBillNumber + 1;
	} catch (err) {
		logError(err as Error, "Error getting next bill number");
		throw err;
	}
}

function uploadReceipt(fileId: string, billId: string) {
	try {
		// Retrieve the file from Google Drive
		const file = DriveApp.getFileById(fileId);
		const fileBlob = file.getBlob();

		// Metadata for the receipt attachment
		const metadata = {
			AttachableRef: [
				{
					EntityRef: {
						type: "Bill",
						value: billId,
					},
				},
			],
			FileName: file.getName(),
			ContentType: fileBlob.getContentType(),
		};

		// Prepare the payload as multipart/form-data
		const boundary = "-------314159265358979323846";
		const endBoundary = `\r\n--${boundary}--\r\n`;

		const payload = `--${boundary}\r\nContent-Disposition: form-data; name="file_metadata_01"; filename="metadata.json"\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
			metadata,
		)}\r\n--${boundary}\r\nContent-Disposition: form-data; name="file_content_01"; filename="${file.getName()}"\r\nContent-Type: ${fileBlob.getContentType()}\r\n\r\n`;

		const postData = Utilities.newBlob(payload).getBytes();
		const fileData = fileBlob.getBytes();
		const endData = Utilities.newBlob(endBoundary).getBytes();

		// Combine payload and file data
		const fullPayload = Utilities.newBlob(
			postData.concat(fileData).concat(endData),
		).getBytes();

		// Upload the file to QuickBooks
		fetchJSON(`${BASE_URL}${getEnv("QUICKBOOKS_COMPANY_ID")}/upload`, {
			method: "post",
			contentType: `multipart/form-data; boundary=${boundary}`,
			payload: fullPayload,
		});

		Logger.log(`Receipt uploaded: ${file.getName()}`);
	} catch (err) {
		logError(err as Error, "Error uploading receipt", { fileId, billId });
		throw err;
	}
}

function createBill(responseData: ResponseData) {
	try {
		const vendorRef = getVendor(responseData);
		if (!vendorRef?.Id) {
			throw new Error(
				`Vendor reference is missing or invalid: ${JSON.stringify(
					vendorRef,
				)}`,
			);
		}

		const accountRef = getAccount(responseData);
		if (!accountRef?.Id) {
			throw new Error(
				`Account reference is missing or invalid: ${JSON.stringify(
					accountRef,
				)}`,
			);
		}

		const classRef = getClass(responseData);
		if (!classRef?.Id) {
			throw new Error(
				`Class reference is missing or invalid: ${JSON.stringify(
					classRef,
				)}`,
			);
		}

		const billNumber = getNextBillNumber();

		const bill = fetchJSON(
			`${BASE_URL}${getEnv("QUICKBOOKS_COMPANY_ID")}/bill`,
			{
				method: "post",
				contentType: "application/json",
				payload: JSON.stringify({
					VendorRef: {
						value: vendorRef.Id,
					},
					TxnDate: responseData["Transaction Date"],
					Line: [
						{
							DetailType: "AccountBasedExpenseLineDetail",
							Amount: responseData["Amount"],
							AccountBasedExpenseLineDetail: {
								AccountRef: {
									value: accountRef.Id,
								},
								ClassRef: {
									value: classRef.Id,
								},
							},
							Description: responseData["Description"],
						},
					],
					CurrencyRef: {
						value: "CAD",
					},
					DocNumber: billNumber,
				}),
			},
		);

		if (!bill || !bill.Bill) {
			throw new Error(
				`Bill creation failed: ${JSON.stringify(bill, null, 2)}`,
			);
		} else {
			Logger.log(
				`Bill created successfully: ${billNumber} - ${responseData["Full Name"]} - ${responseData["Amount"]} - ${responseData["Description"]}`,
			);
		}

		// Upload the receipt
		uploadReceipt(responseData["Receipt"], bill.Bill.Id);

		return bill;
	} catch (err) {
		logError(err as Error, "Error creating bill", { responseData });
		throw err;
	}
}

function prepareWebhookPayload(responseData: ResponseData, billId: string) {
	const receiptUrl = DriveApp.getFileById(responseData["Receipt"]).getUrl();

	const hash = Utilities.computeDigest(
		Utilities.DigestAlgorithm.SHA_256,
		getEnv("SECRET_KEY") +
			billId +
			responseData["Amount"] +
			responseData["Account Number"],
	)
		.map(byte => (byte + 256).toString(16).slice(-2))
		.join("");

	const approvalUrl = `${getEnv(
		"CLOUDFLARE_URL",
	)}/?token=${hash}&billId=${billId}&amount=${
		responseData["Amount"]
	}&accountNumber=${responseData["Account Number"]}`;

	const webhookPayload = {
		content: "<@&1197660176564621363>",
		embeds: [
			{
				title: `Reimbursement Request #${billId}`,
				fields: [
					{
						name: "Full Name",
						value: responseData["Full Name"],
						inline: true,
					},
					{
						name: "Email Address",
						value: responseData["Email Address"],
						inline: true,
					},
					{
						name: "Amount",
						value: responseData["Amount"],
						inline: true,
					},
					{
						name: "Account Number",
						value: responseData["Account Number"],
						inline: true,
					},
					{
						name: "QuickBooks",
						value: `[View Bill](https://qbo.intuit.com/app/bill?&txnId=${billId})`,
						inline: true,
					},
					{
						name: "Receipt",
						value: `[View](${receiptUrl})`,
						inline: true,
					},
					{
						name: "Description",
						value: responseData["Description"],
						inline: false,
					},
					{
						name: "Approve",
						value: approvalUrl,
						inline: false,
					},
				],
			},
		],
	};

	return webhookPayload;
}

//#endregion Helpers

//#region Authorization

function reset() {
	getService().reset();
}

function getService() {
	const config = JSON.parse(
		UrlFetchApp.fetch(
			"https://developer.intuit.com/.well-known/openid_configuration",
		).getContentText(),
	);

	return OAuth2.createService("Quickbooks")
		.setAuthorizationBaseUrl(config.authorization_endpoint)
		.setTokenUrl(config.token_endpoint)
		.setClientId(getEnv("QUICKBOOKS_CLIENT_ID"))
		.setClientSecret(getEnv("QUICKBOOKS_CLIENT_SECRET"))
		.setScope(API_SCOPE)
		.setCallbackFunction("authCallback")
		.setParam("response_type", config.response_types_supported[0])
		.setParam("state", getStateToken("authCallback"))
		.setPropertyStore(PropertiesService.getUserProperties());
}

function authCallback(request: any) {
	const service = getService();
	const authorized = service.handleCallback(request);
	if (authorized) {
		Logger.log("Success!");
		return HtmlService.createHtmlOutput("Success! You can close this tab.");
	} else {
		Logger.log("Denied!");
		return HtmlService.createHtmlOutput("Denied. You can close this tab");
	}
}

function getStateToken(callbackFunction: string) {
	const stateToken = ScriptApp.newStateToken()
		.withMethod(callbackFunction)
		.withTimeout(120)
		.createToken();
	Logger.log(`State token: ${stateToken}`);
	return stateToken;
}

function logRedirectUri() {
	Logger.log(getService().getRedirectUri());
}

function authorizeQuickBooks() {
	const service = getService();
	if (!service.hasAccess()) {
		const authorizationUrl = service.getAuthorizationUrl();
		Logger.log(
			"Open the following URL and grant access: %s",
			authorizationUrl,
		);
		return HtmlService.createHtmlOutput(
			`<a href="${authorizationUrl}" target="_blank">Click here to authorize QuickBooks</a>`,
		);
	} else {
		Logger.log("QuickBooks API is already authorized.");
	}
}

function testAuthorization() {
	const service = getService();
	if (service.hasAccess()) {
		Logger.log("Authorization is working correctly.");
	} else {
		Logger.log("Authorization required.");
		authorizeQuickBooks(); // This will output the authorization URL if needed
	}
}

//#endregion Authorization

//#region Utilities

function getEnv(key: string) {
	const value = PropertiesService.getScriptProperties().getProperty(key);
	if (!value) {
		throw new Error(`Script property not found: ${key}`);
	}
	return value;
}

function fetchJSON(
	url: string,
	options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions,
) {
	const response = UrlFetchApp.fetch(url, {
		...options,
		headers: {
			...options.headers,
			Authorization: `Bearer ${getService().getAccessToken()}`,
			Accept: "application/json",
		},
		muteHttpExceptions: true,
	});

	try {
		return JSON.parse(response.getContentText());
	} catch (err) {
		Logger.log(
			`Error parsing response from URL: ${url}, Response: ${response.getContentText()}`,
		);
		throw err;
	}
}

function logJSON(json: Record<string, any>) {
	Logger.log(JSON.stringify(json, null, 2));
}

function sendDiscordWebhook(webhookPayload: any) {
	UrlFetchApp.fetch(getEnv("DISCORD_WEBHOOK_URL"), {
		method: "post",
		contentType: "application/json",
		payload: JSON.stringify(webhookPayload),
	});

	Logger.log("Discord webhook sent successfully");
}

function isValidResponseData(responseData: any): responseData is ResponseData {
	for (const field of Object.keys(responseData)) {
		if (!responseData[field]) {
			return false;
		}
	}

	return true;
}

function logError(error: Error, contextMessage: string, data?: any) {
	Logger.log(
		`ERROR: ${contextMessage}\nMessage: ${error.message}\nStack: ${error.stack}`,
	);
	if (data) {
		Logger.log(`Additional data: ${JSON.stringify(data, null, 2)}`);
	}
}

//#endregion Utilities
