import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});
	
	test('Command should be registered', async () => {
		// Get all commands
		const commands = await vscode.commands.getCommands();
		// Check if our command is registered
		assert.ok(commands.includes('smiles-visualization.showMolecule'), 
			'Command smiles-visualization.showMolecule should be registered');
	});
});