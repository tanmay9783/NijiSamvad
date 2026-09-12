import { test, expect } from '@playwright/test';

async function joinRoom(page, userName, roomName, roomSecret) {
  await page.goto('/');
  await page.getByPlaceholder('Enter your display name').fill(userName);
  await page.getByPlaceholder('Enter or generate room ID').fill(roomName);
  await page.getByPlaceholder('Enter or generate high-entropy room secret').fill(roomSecret);
  await page.getByRole('button', { name: 'Join Encrypted Room' }).click();
  await expect(page.getByPlaceholder('Type a secure message...')).toBeVisible({ timeout: 15000 });
}

test.describe('Media & Screen Share Fallbacks', () => {
  
  test('Camera failure graceful degradation', async ({ browser }) => {
    // We launch a context where getUserMedia explicitly fails
    const context = await browser.newContext({
      permissions: [] // Deny all permissions
    });
    const page = await context.newPage();
    
    await joinRoom(page, 'NoCamUser', 'media-room', 'secret');
    await page.getByTitle('Start Video Call').click();

    // Verify application does not crash
    await expect(page.locator('.outgoing-call-card')).toBeVisible();
    
    // We can verify it didn't throw an unhandled React error.
    await expect(page.locator('.error-boundary-container')).not.toBeVisible();

    await context.close();
  });

  test('Screen sharing mock & track replace', async ({ browser }) => {
    // Chrome allows mocking getDisplayMedia when --use-fake-ui-for-media-stream is set
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    
    await joinRoom(pageA, 'Alice', 'screen-room', 'secret');
    await joinRoom(pageB, 'Bob', 'screen-room', 'secret');

    await pageA.getByTitle('Start Video Call').click();
    await pageB.getByRole('button', { name: /Accept/i }).click();

    // Start screen share
    // The button title is "Share Screen"
    await pageA.locator('button[title="Share Screen"]').click();

    // Verify it changes to Stop Sharing Screen
    await expect(pageA.locator('.screen-share-banner')).toBeVisible();
    await expect(pageA.locator('button[title="Stop Sharing Screen"]')).toBeVisible();

    // Stop screen share
    await pageA.locator('button[title="Stop Sharing Screen"]').click();
    await expect(pageA.locator('.screen-share-banner')).not.toBeVisible();

    await contextA.close();
    await contextB.close();
  });
});
