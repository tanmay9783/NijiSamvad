import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

async function joinRoom(page, userName, roomName, roomSecret) {
  await page.goto('/');
  await page.getByPlaceholder('Enter your display name').fill(userName);
  await page.getByPlaceholder('Enter or generate room ID').fill(roomName);
  await page.getByPlaceholder('Enter or generate high-entropy room secret').fill(roomSecret);
  await page.getByRole('button', { name: 'Join Encrypted Room' }).click();
  await expect(page.locator('.toast.success')).toBeVisible({ timeout: 10000 });
}

test.describe('Attachments', () => {

  test('Encrypted upload/download E2E', async ({ browser }) => {
    // We upload a file from A and verify B can see it
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    
    const roomName = 'attachment-room';
    const secret = 'secret-123';

    await joinRoom(pageA, 'Alice', roomName, secret);
    await joinRoom(pageB, 'Bob', roomName, secret);

    // Create a temporary file to upload
    const testFilePath = path.join('/tmp', 'test-upload.txt');
    fs.writeFileSync(testFilePath, 'Hello from Alice attachment');

    // Alice uploads file
    // Our attach button wraps an input[type="file"], we can just use setInputFiles on it
    await pageA.locator('input[type="file"]').setInputFiles(testFilePath);

    // Verify Bob receives it
    await expect(pageB.locator('.message-list')).toContainText('test-upload.txt', { timeout: 15000 });

    await contextA.close();
    await contextB.close();
  });
});
