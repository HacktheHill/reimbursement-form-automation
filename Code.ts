declare const OAuth2: any;

const BASE_URL = "https://quickbooks.api.intuit.com/v3/company/";
const API_SCOPE = "com.intuit.quickbooks.accounting";

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
	}, {} as ResponseData);

	try {
		createBill(responseData);
	} catch (err) {
		// Send an email to the finance team if an error occurs
		MailApp.sendEmail(
			"finance@hackthehill.com",
			"Error creating bill",
			`Error creating bill: ${err.message}`,
		);
		throw err;
	}
	return 0;
}

//#region Helpers

function getVendor(responseData: ResponseData) {
	const QUICKBOOKS_COMPANY_ID = getScriptProperties().getProperty(
		"QUICKBOOKS_COMPANY_ID",
	);

	// Query the QuickBooks API to find the vendor
	const vendorQuery = `SELECT * FROM Vendor WHERE DisplayName = '${responseData["Full Name"]}'`;
	const VendorQueryResponse = fetchJSON(
		`${BASE_URL}${QUICKBOOKS_COMPANY_ID}/query?query=${encodeURIComponent(
			vendorQuery,
		)}`,
		{
			method: "get",
		},
	) as VendorQueryResponse;
	const vendors = VendorQueryResponse.QueryResponse.Vendor ?? [];

	// Create the vendor if it doesn't exist
	if (vendors.length === 0) {
		vendors[0] = fetchJSON(`${BASE_URL}${QUICKBOOKS_COMPANY_ID}/vendor`, {
			method: "post",
			contentType: "application/json",
			payload: JSON.stringify({
				PrimaryEmailAddr: {
					Address: responseData["Email Address"],
				},
				DisplayName: responseData["Full Name"],
			}),
		});
		Logger.log(`Vendor created: ${responseData["Full Name"]}`);
	} else if (vendors.length > 1) {
		throw new Error(`Multiple vendors found: ${responseData["Full Name"]}`);
	}

	// Log the vendor
	const vendorRef = vendors[0];
	Logger.log(`Vendor: ${responseData["Full Name"]}`);

	return vendorRef;
}

function getAccount(responseData: ResponseData) {
	const QUICKBOOKS_COMPANY_ID = getScriptProperties().getProperty(
		"QUICKBOOKS_COMPANY_ID",
	);

	// Query the QuickBooks API to get the account
	const accountQuery = `SELECT * FROM Account WHERE AccountType = 'Expense'`;
	const accountQueryResponse = fetchJSON(
		`${BASE_URL}${QUICKBOOKS_COMPANY_ID}/query?query=${encodeURIComponent(
			accountQuery,
		)}`,
		{
			method: "get",
		},
	) as AccountQueryResponse;

	// Filter the accounts by account number
	const accounts = accountQueryResponse.QueryResponse.Account.filter(
		account => account.AcctNum === responseData["Account Number"],
	);

	// Throw an error if no account is found or multiple accounts are found
	if (accounts.length === 0) {
		throw new Error(`Account not found: ${responseData["Account Number"]}`);
	} else if (accounts.length > 1) {
		throw new Error(
			`Multiple accounts found: ${responseData["Account Number"]}`,
		);
	}

	// Log the account
	const accountRef = accounts[0];
	Logger.log(`Account: ${responseData["Account Number"]}`);

	return accountRef;
}

function getClass(responseData: ResponseData) {
	const QUICKBOOKS_COMPANY_ID = getScriptProperties().getProperty(
		"QUICKBOOKS_COMPANY_ID",
	);

	// Query the QuickBooks API to get the class
	const classQuery = `SELECT * FROM Class WHERE Name = '${responseData["Class"]}'`;
	const ClassQueryResponse = fetchJSON(
		`${BASE_URL}${QUICKBOOKS_COMPANY_ID}/query?query=${encodeURIComponent(
			classQuery,
		)}`,
		{
			method: "get",
		},
	) as ClassQueryResponse;
	const classes = ClassQueryResponse.QueryResponse.Class;

	// Throw an error if no class is found or multiple classes are found
	if (classes.length === 0) {
		throw new Error(`Class not found: ${responseData["Class"]}`);
	} else if (classes.length > 1) {
		throw new Error(`Multiple classes found: ${responseData["Class"]}`);
	}

	// Log the class
	const classRef = classes[0];
	Logger.log(`Class: ${responseData["Class"]}`);

	return classRef;
}

function getNextBillNumber() {
	const QUICKBOOKS_COMPANY_ID = getScriptProperties().getProperty(
		"QUICKBOOKS_COMPANY_ID",
	);

	const billQuery = `SELECT * FROM Bill ORDER BY DocNumber DESC`;
	const billQueryResponse = fetchJSON(
		`${BASE_URL}${QUICKBOOKS_COMPANY_ID}/query?query=${encodeURIComponent(
			billQuery,
		)}`,
		{
			method: "get",
		},
	) as BillQueryResponse;
	const bills = billQueryResponse.QueryResponse.Bill ?? [];

	// Get the latest correctly formatted bill number
	const latestBillNumber = bills.find(bill => {
		return /^\d{6}$/.test(bill.DocNumber);
	})?.DocNumber;

	// Throw an error if no bill is found
	if (!latestBillNumber) {
		throw new Error("No bill found from which to get the next bill number");
	}

	// Increment the bill number
	const nextBillNumber = (parseInt(latestBillNumber) + 1)
		.toString()
		.padStart(6, "0");

	return nextBillNumber;
}

function uploadReceipt(fileId: string, billId: string) {
	const QUICKBOOKS_COMPANY_ID = getScriptProperties().getProperty(
		"QUICKBOOKS_COMPANY_ID",
	);

	// Retrieve the file from Google Drive
	const file = DriveApp.getFileById(fileId);
	const fileBlob = file.getBlob();

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

	const fullPayload = Utilities.newBlob(
		postData.concat(fileData).concat(endData),
	).getBytes();

	// Upload the file to QuickBooks
	fetchJSON(`${BASE_URL}${QUICKBOOKS_COMPANY_ID}/upload`, {
		method: "post",
		contentType: `multipart/form-data; boundary=${boundary}`,
		payload: fullPayload,
	});

	Logger.log(`Receipt uploaded: ${file.getName()}`);
}

function createBill(responseData: ResponseData) {
	const QUICKBOOKS_COMPANY_ID = getScriptProperties().getProperty(
		"QUICKBOOKS_COMPANY_ID",
	);

	const vendorRef = getVendor(responseData);
	const accountRef = getAccount(responseData);
	const classRef = getClass(responseData);
	const billNumber = getNextBillNumber();

	const bill = fetchJSON(`${BASE_URL}${QUICKBOOKS_COMPANY_ID}/bill`, {
		method: "post",
		contentType: "application/json",
		payload: JSON.stringify({
			VendorRef: {
				value: vendorRef.Id,
			},
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
	});

	Logger.log(
		`Bill created: ${billNumber} - ${responseData["Full Name"]} - ${responseData["Amount"]} - ${responseData["Description"]}`,
	);

	// Upload the receipt
	uploadReceipt(responseData["Receipt"], bill.Bill.Id);

	return bill;
}

//#endregion Helpers

//#region Authorization

function reset() {
	getService().reset();
}

function getService() {
	const QUICKBOOKS_CLIENT_ID = getScriptProperties().getProperty(
		"QUICKBOOKS_CLIENT_ID",
	);
	const QUICKBOOKS_CLIENT_SECRET = getScriptProperties().getProperty(
		"QUICKBOOKS_CLIENT_SECRET",
	);

	const config = JSON.parse(
		UrlFetchApp.fetch(
			"https://developer.intuit.com/.well-known/openid_configuration",
		).getContentText(),
	);

	return OAuth2.createService("Quickbooks")
		.setAuthorizationBaseUrl(config.authorization_endpoint)
		.setTokenUrl(config.token_endpoint)
		.setClientId(QUICKBOOKS_CLIENT_ID)
		.setClientSecret(QUICKBOOKS_CLIENT_SECRET)
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
	return stateToken;
}

function logRedirectUri() {
	Logger.log(getService().getRedirectUri());
}

//#endregion Authorization

//#region Utilities

function getScriptProperties() {
	return PropertiesService.getScriptProperties();
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
		return response.getContentText();
	}
}

function logJSON(json: Record<string, any>) {
	Logger.log(JSON.stringify(json, null, 2));
}

//#endregion Utilities
