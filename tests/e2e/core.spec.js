import { test, expect } from '@playwright/test';

// Helper to join a room
async function joinRoom(page, userName, roomName, roomSecret) {
  await page.goto('/');
  await page.getByPlaceholder('Enter your display name').fill(userName);
  await page.getByPlaceholder('Enter or generate room ID').fill(roomName);
  await page.getByPlaceholder('Enter or generate high-entropy room secret').fill(roomSecret);
  await page.getByRole('button', { name: 'Join Encrypted Room' }).click();
  // Wait for success toast
  await expect(page.locator('.toast.success')).toBeVisible({ timeout: 10000 });
}

test.describe('Core E2EE & Room Dynamics', () => {

  test('E2EE messaging works across users with the same secret', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    
    const roomName = 'e2ee-test-room';
    const secret = 'super-secure-secret-123';

    await joinRoom(pageA, 'UserA', roomName, secret);
    await joinRoom(pageB, 'UserB', roomName, secret);

    // User A sends a message
    await pageA.getByPlaceholder('Type a message...').fill('Hello from A');
    // Using simple locator since icon buttons might not have name
    await pageA.locator('.send-btn').click();

    // Verify User B receives and decrypts it
    await expect(pageB.locator('.message-list')).toContainText('Hello from A');
    await expect(pageB.locator('.message-list')).not.toContainText('Encrypted message');
    
    // Verify Security indicators
    await pageA.locator('.secure-badge').click();
    await expect(pageA.locator('.security-modal')).toBeVisible();
    await expect(pageA.locator('.security-modal')).toContainText('E2EE Active');

    await contextA.close();
    await contextB.close();
  });

  test('Wrong secret decryption failure', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    
    const roomName = 'wrong-secret-room';

    await joinRoom(pageA, 'Alice', roomName, 'correct-secret');
    await joinRoom(pageB, 'Bob', roomName, 'wrong-secret');

    // Alice sends a message
    await pageA.getByPlaceholder('Type a message...').fill('Top Secret Data');
    await pageA.locator('.send-btn').click();

    // Bob receives it but cannot decrypt
    await expect(pageB.locator('.message-list')).toContainText('Encrypted message');
    await expect(pageB.locator('.message-list')).not.toContainText('Top Secret Data');
    
    await contextA.close();
    await contextB.close();
  });

  test('Room isolation test', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    
    const secret = 'shared-secret';

    await joinRoom(pageA, 'Alice', 'Room-A', secret);
    await joinRoom(pageB, 'Bob', 'Room-B', secret);

    // Alice sends a message in Room A
    await pageA.getByPlaceholder('Type a message...').fill('Message for Room A');
    await pageA.locator('.send-btn').click();

    // Bob sends a message in Room B
    await pageB.getByPlaceholder('Type a message...').fill('Message for Room B');
    await pageB.locator('.send-btn').click();

    // Verify isolation
    await expect(pageA.locator('.message-list')).toContainText('Message for Room A');
    await expect(pageA.locator('.message-list')).not.toContainText('Message for Room B');
    
    await expect(pageB.locator('.message-list')).toContainText('Message for Room B');
    await expect(pageB.locator('.message-list')).not.toContainText('Message for Room A');

    await contextA.close();
    await contextB.close();
  });
});
