import * as vscode from 'vscode';


let decorationType: vscode.TextEditorDecorationType;
let currentPanel: vscode.WebviewPanel | undefined = undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('RDKit Molecule Viewer extension is now active');

    // Create a decoration type for highlighting valid SMILES strings
    decorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(100, 200, 255, 0.1)',
        border: '1px solid rgba(100, 200, 255, 0.5)'
    });

    // Register the command to show molecule from selected SMILES
    let disposable = vscode.commands.registerCommand('rdkit-viewer.showMolecule', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const selection = editor.selection;
        if (selection.isEmpty) return;

        const selectedText = editor.document.getText(selection);
        if (!validateSmiles(selectedText)) {
            vscode.window.showInformationMessage('Selected text is not a valid SMILES string.');
            return;
        }

        showMoleculeViewer(context.extensionUri, selectedText, editor, selection);
    });

    vscode.languages.registerHoverProvider({ pattern: '**/*' }, {
        provideHover(document, position, token) {
            const range = document.getWordRangeAtPosition(position, /[A-Za-z][A-Za-z0-9@+\-\[\]\(\)\\\/%.=#]*/g) || 
            document.getWordRangeAtPosition(position, /\S+/);
            if (!range) return null;
            
            const text = document.getText(range);
            if (validateSmiles(text)) {
                const commandUri = vscode.Uri.parse(
                    `command:rdkit-viewer.showSmilesFromHover?${encodeURIComponent(JSON.stringify([text]))}`
                );

                vscode.commands.executeCommand('rdkit-viewer.showSmilesFromHover', text);

                return null; 
            }
            return null;
        }
    });

    context.subscriptions.push(
        vscode.commands.registerCommand('rdkit-viewer.showSmilesFromHover', (smilesString: string) => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;
            
            showMoleculeViewer(context.extensionUri, smilesString, editor, editor.selection);
        })
    );

    vscode.window.onDidChangeTextEditorSelection(event => {
        const editor = event.textEditor;
        const selection = editor.selection;
        
        // Clear previous decorations
        editor.setDecorations(decorationType, []);
        
        if (selection.isEmpty) {
            if (currentPanel) {
                currentPanel.dispose();
                currentPanel = undefined;
            }
            return;
        }
        
        const selectedText = editor.document.getText(selection);
        if (validateSmiles(selectedText)) {
            // Highlight the valid SMILES string
            editor.setDecorations(decorationType, [selection]);
            
            // Automatically show the molecule
            showMoleculeViewer(context.extensionUri, selectedText, editor, selection);
        } else if (currentPanel) {
            currentPanel.dispose();
            currentPanel = undefined;
        }
    });

    context.subscriptions.push(disposable);
}

function showMoleculeViewer(
    extensionUri: vscode.Uri, 
    smilesString: string, 
    editor: vscode.TextEditor, 
    selection: vscode.Selection
) {
    // Calculate position for the panel near the selection
    const position = editor.selection.active;
    const positionInEditor = editor.visibleRanges[0].start;

    // Create a new panel if it doesn't exist, otherwise reuse it
    if (!currentPanel) {
        currentPanel = vscode.window.createWebviewPanel(
            'rdkitMoleculeViewer',
            'Molecule Viewer',
            {
                viewColumn: vscode.ViewColumn.Beside,
                preserveFocus: true
            },
            {
                enableScripts: true,
                localResourceRoots: [extensionUri]
            }
        );

        // Handle closing the panel
        currentPanel.onDidDispose(() => {
            currentPanel = undefined;
        });
    }

    const rdkitJsUri = vscode.Uri.joinPath(extensionUri, 'dist', 'rdkit', 'RDKit_minimal.js');
    const rdkitPath = currentPanel.webview.asWebviewUri(rdkitJsUri);

    // Update the HTML content for the webview
    currentPanel.webview.html = getWebviewContent(smilesString, rdkitPath.toString());
}

function getWebviewContent(smilesString: string, rdkitPath: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RDKit Molecule Viewer</title>
    <style>
        body {
            padding: 0;
            margin: 0;
            background-color: transparent;
        }
        .container {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 10px;
        }
        #molecule-display {
            width: 300px;
            height: 250px;
            border: 1px solid #ccc;
            margin-bottom: 10px;
            background-color: white;
        }
        .smiles-text {
            font-family: monospace;
            margin-bottom: 10px;
            word-break: break-all;
        }
    </style>
</head>
<body>
    <div class="container">
        <div id="molecule-display"></div>
        <div class="smiles-text">${smilesString}</div>
    </div>

    <script src="${rdkitPath}"></script>
    <script>
        // Initialize RDKit
        window.onload = async function() {
            // Initialize RDKit
            try {
                const RDKit = await window.initRDKitModule();
                const smiles = '${smilesString.replace(/'/g, "\\'")}';
                console.log('SMILES string:', smiles);
                // Create molecule from SMILES
                const mol = RDKit.get_mol(smiles);
                
                if (mol) {
                    // Generate SVG and display molecule
                    const svg = mol.get_svg(300, 250);
                    document.getElementById('molecule-display').innerHTML = svg;
                    
                    // Clean up
                    mol.delete();
                } else {
                    document.getElementById('molecule-display').innerHTML = 
                        '<div style="color: red; text-align: center; padding-top: 100px;">Invalid SMILES string</div>';
                }
            } catch (error) {
                console.error('Error initializing RDKit:', error);
                document.getElementById('molecule-display').innerHTML = 
                    '<div style="color: red; text-align: center; padding-top: 100px;">Error loading RDKit</div>';
            }
        };
    </script>
</body>
</html>`;
}


export function validateSmiles(smiles: string): boolean {

    const smilesRegex = /^([^J](?:B(?:r)[0-9BCOHNSOPIF@+\-\[\]\(\)\\\/%=#$]{2,}|[0-9COHNSOPIF@+\-\[\]\(\)\\\/%=#$]{3,}))$/ig
    return smilesRegex.test(smiles.trim());
}

export function deactivate() {
    if (currentPanel) {
        currentPanel.dispose();
    }
}
