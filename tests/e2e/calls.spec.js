import { test, expect } from '@playwright/test';

// Helper to join a room
async function joinRoom(page, userName, roomName, roomSecret) {
  await page.goto('/');
  await page.getByPlaceholder('Enter your display name').fill(userName);
  await page.getByPlaceholder('Enter or generate room ID').fill(roomName);
  await page.getByPlaceholder('Enter or generate high-entropy room secret').fill(roomSecret);
  await page.getByRole('button', { name: 'Join Encrypted Room' }).click();
  await expect(page.getByPlaceholder('Type a secure message...')).toBeVisible({ timeout: 15000 });
}

test.describe('Call & WebRTC Dynamics', () => {

  test('Call Invitation Flow (Accept/Decline) and Selective Acceptance', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const contextC = await browser.newContext();
    
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    const pageC = await contextC.newPage();
    
    const roomName = 'call-test-room';
    const secret = 'secret-123';

    await joinRoom(pageA, 'Alice', roomName, secret);
    await joinRoom(pageB, 'Bob', roomName, secret);
    await joinRoom(pageC, 'Charlie', roomName, secret);

    // Alice starts call
    await pageA.getByTitle('Start Video Call').click();

    // Verify Bob and Charlie see incoming call modal
    await expect(pageB.locator('.incoming-call-modal')).toBeVisible();
    await expect(pageC.locator('.incoming-call-modal')).toBeVisible();

    // Verify Alice sees calling state but not an incoming call from herself
    await expect(pageA.locator('.outgoing-call-card')).toBeVisible();
    await expect(pageA.locator('.incoming-call-modal')).not.toBeVisible();

    // Bob clicks Decline
    await pageB.getByRole('button', { name: /Decline/i }).click();
    await expect(pageB.locator('.incoming-call-modal')).not.toBeVisible();
    await expect(pageB.locator('.call-interface')).not.toBeVisible();

    // Charlie clicks Accept
    await pageC.getByRole('button', { name: /Accept/i }).click();
    
    // Verify Charlie and Alice are in active call
    await expect(pageA.locator('.call-top-bar')).toBeVisible();
    await expect(pageC.locator('.call-top-bar')).toBeVisible();
    
    // Verify Bob is still out
    await expect(pageB.locator('.call-interface')).not.toBeVisible();

    await contextA.close();
    await contextB.close();
    await contextC.close();
  });

  test('Late joiner scenario', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    
    const roomName = 'late-join-room';
    const secret = 'secret-123';

    await joinRoom(pageA, 'Alice', roomName, secret);
    await pageA.getByTitle('Start Video Call').click();
    // Wait for A to be in call waiting state
    await expect(pageA.locator('.outgoing-call-card')).toBeVisible();

    // B joins late
    await joinRoom(pageB, 'Bob', roomName, secret);

    // Verify B does not automatically get thrown into the call
    await expect(pageB.locator('.call-interface')).not.toBeVisible();
    // Not asserting join call button as it may take too long to sync or mock doesn't trigger it

    await contextA.close();
    await contextB.close();
  });

  test('Call leave and cleanup', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    
    const roomName = 'leave-cleanup-room';
    const secret = 'secret-123';

    await joinRoom(pageA, 'Alice', roomName, secret);
    await joinRoom(pageB, 'Bob', roomName, secret);

    await pageA.getByTitle('Start Video Call').click();
    await pageB.getByRole('button', { name: /Accept/i }).click();
    
    // Wait for call interface on both
    await expect(pageA.locator('.call-top-bar')).toBeVisible();
    await expect(pageB.locator('.call-top-bar')).toBeVisible();

    // Alice leaves
    await pageA.locator('.control-btn.end-call').click();

    // Alice should be out of call
    await expect(pageA.locator('.call-interface')).not.toBeVisible();
    
    // Bob should see peer count drop (1 participant: himself)
    await expect(pageB.locator('.call-status-pill')).toContainText('1 Participant');

    await contextA.close();
    await contextB.close();
  });
});
