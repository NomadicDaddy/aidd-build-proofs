// scripts/setup.ts
/**
 * @fileoverview Setup and validation script for md-toc utility.
 * This script initializes the environment, installs dependencies, and validates prerequisites.
 * DO NOT run this script to start the application; it only prepares the environment.
 */

import { exec } from 'child_process';
import { promisify } from 'util';

// Promisify exec for async/await usage
const execPromise = promisify(exec);

/**
 * Checks if Bun is installed and accessible.
 */
async function checkBunPrerequisites() {
    console.log("--- 🛠️ Step 1: Checking Prerequisites (Bun) ---");
    try {
        // Simple test command
        await execPromise('bun --version');
        console.log("✅ Bun is installed and accessible.");
    } catch (error) {
        console.error("\n❌ ERROR: 'bun' command not found.\n---------------------------------------");
        console.error("Please ensure Bun is installed globally before running the project setup:");
        console.error("npm install -g bun || curl -sL https://bun.sh/install | bash\n");
        process.exit(1);
    }
}

/**
 * Installs all necessary dependencies defined in package.json.
 */
async function installDependencies() {
    console.log("\n--- 📦 Step 2: Installing Dependencies ---");
    try {
        // Use bun install as per best practices for the project stack
        await execPromise('bun install');
        console.log("✅ All dependencies installed successfully.");
    } catch (error) {
        console.error("\n❌ ERROR during dependency installation:");
        console.error(error.stderr || error.stdout);
        process.exit(1);
    }
}

/**
 * Validates the file system structure and confirms basic project readiness.
 */
async function validateEnvironment() {
    console.log("\n--- 📚 Step 3: Environment Validation ---");
    // Since this is a CLI tool, validation mainly checks for common missing files/configs.
    const requiredFiles = ['package.json', 'tsconfig.json']; // Assuming these exist

    for (const file of requiredFiles) {
        try {
            await execPromise(`test -f ${file}`);
            console.log(`✅ Found essential file: ${file}`);
        } catch (e) {
            console.warn(`⚠️ WARNING: Required file ${file} not found. Manual check recommended.`);
        }
    }

    // Final success message
    console.log("\n=============================================");
    console.log("✨ SETUP COMPLETE!");
    console.log("The development environment is ready for use.");
    console.log("---------------------------------------------");
    console.log("🚀 To run the application, execute:");
    console.log("bun run build && bunx ./.bin/cli <file-path>"); // Example execution flow
}

/**
 * Main function to orchestrate setup steps.
 */
async function setup() {
    await checkBunPrerequisites();
    await installDependencies();
    await validateEnvironment();
}

setup().catch(err => {
    console.error("\n🚨 CRITICAL FAILURE during setup:", err);
    process.exit(1);
});