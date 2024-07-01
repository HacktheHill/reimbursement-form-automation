interface Env {
	SECRET_KEY: string;
	AUTHORIZED_EMAILS: string;
	DISCORD_WEBHOOK_URL: string;
	SIGNATURES: KVNamespace;
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		return handleRequest(request, env);
	},
} satisfies ExportedHandler<Env>;

async function handleRequest(request: Request, env: Env) {
	const url = new URL(request.url);
	const token = url.searchParams.get("token");
	const billId = url.searchParams.get("billId");
	const amount = url.searchParams.get("amount");
	const accountNumber = url.searchParams.get("accountNumber");

	if (!token || !billId || !amount || !accountNumber) {
		return new Response("Missing required parameters.", {
			status: 400,
			headers: { "Content-Type": "text/html" },
		});
	}

	// Get from request headers
	const user = request.headers.get("Cf-Access-Authenticated-User-Email");
	if (!user) {
		return new Response("Unauthorized", {
			status: 401,
			headers: { "Content-Type": "text/html" },
		});
	}

	if (!(await isAuthorizedUser(env.AUTHORIZED_EMAILS, user))) {
		return new Response(
			"You are not authorized to sign this reimbursement.",
			{
				status: 403,
				headers: { "Content-Type": "text/html" },
			},
		);
	}

	const expectedHash = await generateHash(
		env.SECRET_KEY + billId + amount + accountNumber,
	);

	if (token === expectedHash) {
		await logSignature(env, billId, user);

		const signatures = await getSignatures(env, billId);
		const uniqueSignatories = Array.from(
			new Set(signatures.map((sig: { user: any }) => sig.user)),
		);

		if (uniqueSignatories.length >= 2) {
			await sendDiscordWebhook(env.DISCORD_WEBHOOK_URL, {
				content: `Reimbursement request #${billId} is ready for processing. [View in QuickBooks](https://qbo.intuit.com/app/bill?&txnId=${billId})`,
			});
			return new Response(
				`Reimbursement request #${billId} has been signed by both ${uniqueSignatories.join(
					" and ",
				)} and is ready for processing. <a href="https://qbo.intuit.com/app/bill?&txnId=${billId}" target="_blank">View in QuickBooks</a>`,
				{
					status: 200,
					headers: { "Content-Type": "text/html" },
				},
			);
		} else {
			return new Response(
				`Reimbursement request #${billId} signed. Waiting for another unique signature.`,
				{
					status: 200,
					headers: { "Content-Type": "text/html" },
				},
			);
		}
	} else {
		return new Response("Invalid token.", {
			status: 401,
			headers: {"Content-Type": "text/html",
			},
		});
	}
}

async function isAuthorizedUser(authorizedEmails: string, email: string) {
	const authorizedList = authorizedEmails.split(",");
	return authorizedList.includes(email);
}

async function logSignature(env: Env, billId: string, user: string) {
	const signatures = await getSignatures(env, billId);
	signatures.push({ date: new Date().toISOString(), user });
	await env.SIGNATURES.put(billId, JSON.stringify(signatures));
	await sendDiscordWebhook(env.DISCORD_WEBHOOK_URL, {
		content: `Reimbursement request #${billId} has been signed by ${user}.`,
	});
}

async function getSignatures(env: Env, billId: string) {
	const signatures = await env.SIGNATURES.get(billId);
	return signatures ? JSON.parse(signatures) : [];
}

async function generateHash(input: string | undefined) {
	const encoder = new TextEncoder();
	const data = encoder.encode(input);
	const hash = await crypto.subtle.digest("SHA-256", data);
	return Array.from(new Uint8Array(hash))
		.map(b => b.toString(16).padStart(2, "0"))
		.join("");
}

async function sendDiscordWebhook(url: string, payload: any) {
	await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(payload),
	});
}
