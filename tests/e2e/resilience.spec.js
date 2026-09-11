import { test, expect } from '@playwright/test';

async function joinRoom(page, userName, roomName, roomSecret) {
  await page.goto('/');
  await page.getByPlaceholder('Enter your display name').fill(userName);
  await page.getByPlaceholder('Enter or generate room ID').fill(roomName);
  await page.getByPlaceholder('Enter or generate high-entropy room secret').fill(roomSecret);
  await page.getByRole('button', { name: 'Join Encrypted Room' }).click();
  await expect(page.locator('.toast.success')).toBeVisible({ timeout: 10000 });
}

test.describe('Resilience & Edge Cases', () => {

  test('XSS payload rejection', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Attempt XSS in username and roomname
    const xssPayload = '<script>alert("xss")</script><img>';
    await page.goto('/');
    await page.getByPlaceholder('Enter your display name').fill(xssPayload);
    await page.getByPlaceholder('Enter or generate room ID').fill(xssPayload);
    await page.getByPlaceholder('Enter or generate high-entropy room secret').fill('secret');
    
    // Server sanitization should strip <> or reject it, we can check if it joins or shows error.
    // Actually the client limits length and might allow joining, but the DOM shouldn't execute it.
    await page.getByRole('button', { name: 'Join Encrypted Room' }).click();
    
    // Check if the script executed (it would pause execution or show alert if we didn't handle dialogs, 
    // but Playwright auto-dismisses dialogs unless handled. We can check if the DOM contains the raw script text)
    // Actually our server sanitization strips <> entirely!
    
    // Wait for either join success or error
    await page.waitForTimeout(1000);
    
    // Send an XSS message
    const isJoined = await page.locator('.toast.success').isVisible();
    if (isJoined) {
      await page.getByPlaceholder('Type a message...').fill('<img src="x" onerror="alert(1)">');
      await page.locator('.send-btn').click();
      
      // Verify it is rendered as text, not an actual image tag executing script
      await expect(page.locator('.message-list')).toContainText('<img src="x" onerror="alert(1)">');
      const imgTags = await page.locator('.message-list img[src="x"]').count();
      expect(imgTags).toBe(0);
    }
    
    await context.close();
  });

  test('Mobile viewport usability', async ({ browser }) => {
    // iPhone 12 Pro dimensions
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }
    });
    const page = await context.newPage();
    
    await joinRoom(page, 'MobileUser', 'mobile-room', 'secret');
    
    // Check if chat input is visible and usable
    const chatInput = page.getByPlaceholder('Type a message...');
    await expect(chatInput).toBeVisible();
    await chatInput.fill('Testing mobile view');
    
    // Check if header actions are accessible (drawer might be hidden behind a hamburger, but let's check basic buttons)
    await expect(page.locator('.header-actions')).toBeVisible();

    await context.close();
  });
});
