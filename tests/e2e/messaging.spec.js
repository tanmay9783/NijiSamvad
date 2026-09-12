import { test, expect } from '@playwright/test';

// Helper to join a room
async function joinRoom(page, userName, roomName, roomSecret) {
  await page.goto('/');
  await page.getByPlaceholder('Enter your display name').fill(userName);
  await page.getByPlaceholder('Enter or generate room ID').fill(roomName);
  await page.getByPlaceholder('Enter or generate high-entropy room secret').fill(roomSecret);
  await page.getByRole('button', { name: 'Join Encrypted Room' }).click();
  // Wait for success toast
  await expect(page.getByPlaceholder('Type a secure message...')).toBeVisible({ timeout: 15000 });
}

test.describe('Messaging UX (Replies & Mentions)', () => {

  test('Reply to a message', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    
    const roomName = 'reply-test-room';
    const secret = 'reply-secret-123';

    await joinRoom(pageA, 'UserA', roomName, secret);
    await joinRoom(pageB, 'UserB', roomName, secret);

    // User A sends a message
    await pageA.getByPlaceholder('Type a secure message...').fill('First message');
    await pageA.getByTitle('Send message').click();

    // Verify User B receives it
    const msgB = pageB.locator('.message-content').filter({ hasText: 'First message' });
    await expect(msgB).toBeVisible();

    // User B replies to it
    await pageB.locator('.message-wrapper').first().hover();
    await pageB.getByTitle('Reply').first().click();
    
    // Check reply context
    await expect(pageB.locator('.composer-reply-context')).toBeVisible();
    await expect(pageB.locator('.composer-reply-context')).toContainText('First message');
    
    await pageB.getByPlaceholder('Type a secure message...').fill('Reply message');
    await pageB.getByTitle('Send message').click();

    // Verify User A receives reply with preview block
    await expect(pageA.locator('.reply-preview-block')).toBeVisible();
    await expect(pageA.locator('.reply-preview-block')).toContainText('First message');
    await expect(pageA.locator('.message-wrapper')).toContainText('Reply message');

    await contextA.close();
    await contextB.close();
  });

  test('Mention a user', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    
    const roomName = 'mention-test-room';
    const secret = 'mention-secret-123';

    await joinRoom(pageA, 'Alice', roomName, secret);
    await joinRoom(pageB, 'Bob', roomName, secret);

    // Bob types a mention
    await pageB.getByPlaceholder('Type a secure message...').fill('Hey @Al');
    
    // Autocomplete popover should appear
    await expect(pageB.locator('.mention-popover')).toBeVisible();
    await expect(pageB.locator('.mention-option')).toContainText('Alice');
    
    // Press Tab to autocomplete
    await pageB.getByPlaceholder('Type a secure message...').press('Tab');
    
    // Input should have @Alice
    await expect(pageB.getByPlaceholder('Type a secure message...')).toHaveValue('Hey @Alice ');
    
    await pageB.getByTitle('Send message').click();

    // Alice should see the mention highlighted
    const mentionTag = pageA.locator('.mention-tag');
    await expect(mentionTag).toBeVisible();
    await expect(mentionTag).toContainText('@Alice');
    await expect(mentionTag).toHaveClass(/mention-self/);

    await contextA.close();
    await contextB.close();
  });
});
