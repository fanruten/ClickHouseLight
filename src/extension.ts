import * as vscode from 'vscode';
import * as https from 'https';

export function activate(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('clickhouseLight.makeRequest', () => {
		makeRequest(context);
	});

	context.subscriptions.push(disposable);

	if (vscode.window.registerWebviewPanelSerializer) {
		vscode.window.registerWebviewPanelSerializer(RequestResultPanel.viewType, {
			async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: any) {
				console.log(`Got state: ${state}`);
				RequestResultPanel.revive(webviewPanel, context.extensionUri);
			}
		});
	}
}

// this method is called when your extension is deactivated
export function deactivate() { }

function makeRequest(context: vscode.ExtensionContext) {
	const editor = vscode.window.activeTextEditor;

	if (editor) {
		let document = editor.document;
		const documentText = document.getText();

		const words = documentText.split('\n');
		let config: { [key: string]: string } = {};
		let request = '';

		for (const line of words) {
			if (line.startsWith('### ')) {
				let confLine = line.slice(4);
				let items = confLine.split('=');
				if (items.length === 2) {
					config[items[0]] = items[1];
				}
				request += '\n';
				continue;
			}

			let cleanedLine = line;

			let commentStart = line.indexOf("#");
			if (commentStart !== -1) {
				cleanedLine = line.slice(0, commentStart);
			}

			if (cleanedLine.length > 0) {
				request += cleanedLine;
			}
			request += '\n';
		}

		request += 'FORMAT JSONCompact';

		console.log(`${request}`);

		RequestResultPanel.createOrShow(context.extensionUri, document.uri);

		if (RequestResultPanel.currentPanel) {
			RequestResultPanel.currentPanel.showSpinner();
		}

		const user = config['user'] ?? 'default';
		const password = config['password'] ?? '';
		const server = config['server'];
		const data = request;

		if (server === undefined || server.length === 0) {
			if (RequestResultPanel.currentPanel) {
				RequestResultPanel.currentPanel.displayError({ 'message': 'Set server with "### <server_name>" line' });
			}
			return;
		}

		console.log(`server: ${server}\nrequest:\n${data}`);

		const options = {
			hostname: server,
			port: 443,
			path: '/?log_queries=1&output_format_json_quote_64bit_integers=1&database=default&result_overflow_mode=throw&readonly=1',
			method: 'POST',
			headers: {
				// eslint-disable-next-line @typescript-eslint/naming-convention
				'Content-Type': 'application/json',
				// eslint-disable-next-line @typescript-eslint/naming-convention
				'Content-Length': data.length,
				// eslint-disable-next-line @typescript-eslint/naming-convention
				'X-ClickHouse-User': user,
				// eslint-disable-next-line @typescript-eslint/naming-convention
				'X-ClickHouse-Key': password
			}
		};

		const req = https.request(options, res => {
			res.setEncoding('utf8');

			let statusCode = res.statusCode;
			console.log(`statusCode: ${statusCode}`);

			var data = '';
			res.on('data', chunk => {
				data += chunk;
			});

			res.on('end', function () {
				console.log(`response: ${data}`);

				if (statusCode !== 200) {
					if (RequestResultPanel.currentPanel) {
						RequestResultPanel.currentPanel.displayError({ 'code': statusCode, 'message': res.statusMessage, 'body': data });
					}
					return;
				}

				let json = JSON.parse(data);

				if (RequestResultPanel.currentPanel) {
					RequestResultPanel.currentPanel.displayResults(json);
				}
			});
		});

		req.on('error', error => {
			console.error('Request Error');
			console.error(error);

			if (RequestResultPanel.currentPanel) {
				RequestResultPanel.currentPanel.displayError({ 'message': error.message });
			}
		});

		console.log('start request');
		req.write(data);
		req.end();
	}
};

class RequestResultPanel {
	/**
	 * Track the currently panel. Only allow a single panel to exist at a time.
	 */
	public static currentPanel: RequestResultPanel | undefined;

	public static readonly viewType = 'clickhouseLight';

	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private _disposables: vscode.Disposable[] = [];

	public static createOrShow(extensionUri: vscode.Uri, documentUri: vscode.Uri) {
		const column = vscode.ViewColumn.Three;

		// If we already have a panel, show it.
		if (RequestResultPanel.currentPanel) {
			RequestResultPanel.currentPanel._panel.reveal(column);
			return;
		}

		// Otherwise, create a new panel.
		const panel = vscode.window.createWebviewPanel(
			RequestResultPanel.viewType,
			'Results',
			column,
			{
				// Enable javascript in the webview
				enableScripts: true,

				// And restrict the webview to only loading content from our extension's `media` directory.
				localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
			}
		);

		console.log(vscode.Uri.joinPath(extensionUri, 'media'));

		RequestResultPanel.currentPanel = new RequestResultPanel(panel, extensionUri);
	}

	public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
		RequestResultPanel.currentPanel = new RequestResultPanel(panel, extensionUri);
	}

	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
		this._panel = panel;
		this._extensionUri = extensionUri;

		// Set the webview's initial html content
		this._update();

		// Listen for when the panel is disposed
		// This happens when the user closes the panel or when the panel is closed programatically
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		// Update the content based on view changes
		this._panel.onDidChangeViewState(
			e => {
				if (this._panel.visible) {
				}
			},
			null,
			this._disposables
		);

		// Handle messages from the webview
		this._panel.webview.onDidReceiveMessage(
			message => {
				switch (message.command) {
					case 'alert':
						vscode.window.showErrorMessage(message.text);
						return;
				}
			},
			null,
			this._disposables
		);
	}

	public showSpinner() {
		this._panel.webview.postMessage({ command: 'show_spinner' });
	}

	public displayResults(data: JSON) {
		this._panel.webview.postMessage({ command: 'show_results', data: data });
	}

	public displayError(error: Object) {
		this._panel.webview.postMessage({ command: 'show_error', data: error });
	}

	public dispose() {
		RequestResultPanel.currentPanel = undefined;

		// Clean up our resources
		this._panel.dispose();

		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	private _update() {
		const webview = this._panel.webview;
		this._panel.title = 'Clickhouse results';
		this._panel.webview.html = this._getHtmlForWebview(webview);
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		// Local path to main script run in the webview
		const scriptPathOnDisk = vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js');
		console.log('path: ' + scriptPathOnDisk);

		// And the uri we use to load this script in the webview
		const scriptUri = webview.asWebviewUri(scriptPathOnDisk);

		// Local path to css styles
		const styleResetPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css');
		const stylesPathMainPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css');

		// Uri to load styles into webview
		const stylesResetUri = webview.asWebviewUri(styleResetPath);
		const stylesMainUri = webview.asWebviewUri(stylesPathMainPath);

		// Use a nonce to only allow specific scripts to be run
		const nonce = getNonce();

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<!--
					Use a content security policy to only allow loading images from https or from our extension directory,
					and only allow scripts that have a specific nonce.
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${stylesResetUri}" rel="stylesheet">
				<link href="${stylesMainUri}" rel="stylesheet">
			</head>
			<body>				
				<div id="content"></div>
				<script nonce="${nonce}" src="${scriptUri}"></script>								
			</body>
			</html>`;
	}
}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}