import { test, expect } from '@playwright/test';

// Helper to join a room
async function joinRoom(page, userName, roomName, roomSecret) {
  await page.goto('/');
  await page.getByPlaceholder('Enter your display name').fill(userName);
  await page.getByPlaceholder('Enter or generate room ID').fill(roomName);
  await page.getByPlaceholder('Enter or generate high-entropy room secret').fill(roomSecret);
  await page.getByRole('button', { name: 'Join Encrypted Room' }).click();
  // Wait for success toast
  await expect(page.getByTitle('Send message')).toBeVisible({ timeout: 15000 });
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
    await pageA.getByPlaceholder('Type a secure message...').fill('Hello from A');
    await pageA.getByTitle('Send message').click();

    // Verify User B receives and decrypts it
    await expect(pageB.locator('.message-wrapper')).toContainText('Hello from A');
    await expect(pageB.locator('.message-wrapper')).not.toContainText('Unable to decrypt');
    
    // Verify Security indicators
    await pageA.locator('.security-badge').click();
    await expect(pageA.locator('.modal-content')).toBeVisible();
    await expect(pageA.locator('.modal-content')).toContainText('End-to-End Encrypted');

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
    
    // Alice sends a message
    await pageA.getByPlaceholder('Type a secure message...').fill('Top Secret Data');
    await pageA.getByTitle('Send message').click();

    // Bob tries to join with wrong secret but the server's strict authHash validation rejects him
    await pageB.goto('/');
    await pageB.getByPlaceholder('Enter your display name').fill('Bob');
    await pageB.getByPlaceholder('Enter or generate room ID').fill(roomName);
    await pageB.getByPlaceholder('Enter or generate high-entropy room secret').fill('wrong-secret');
    await pageB.getByRole('button', { name: 'Join Encrypted Room' }).click();
    
    // Server rejects the join and sets connection error
    await expect(pageB.locator('.alert-error')).toBeVisible({ timeout: 15000 });

    
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
    await pageA.getByPlaceholder('Type a secure message...').fill('Message for Room A');
    await pageA.getByTitle('Send message').click();

    // Bob sends a message in Room B
    await pageB.getByPlaceholder('Type a secure message...').fill('Message for Room B');
    await pageB.getByTitle('Send message').click();

    // Verify isolation
    await expect(pageA.locator('.message-wrapper')).toContainText('Message for Room A');
    await expect(pageA.locator('.message-wrapper')).not.toContainText('Message for Room B');
    
    await expect(pageB.locator('.message-wrapper')).toContainText('Message for Room B');
    await expect(pageB.locator('.message-wrapper')).not.toContainText('Message for Room A');

    await contextA.close();
    await contextB.close();
  });
});
