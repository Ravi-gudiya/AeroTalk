import { test, expect } from '@playwright/test';

test.describe('AeroTalk End-to-End User Flow', () => {
  test('Complete Authentication, Friend Request, Messaging, and Feed Flow', async ({ context }) => {
    // 1. Create two separate browser pages to simulate two users simultaneously
    const pageA = await context.newPage();
    const pageB = await context.newPage();

    // Register dialog listeners to print alert messages to console
    pageA.on('dialog', async dialog => {
      console.log('--- Page A Alert Dialog Event ---');
      console.log('Message:', dialog.message());
      await dialog.dismiss();
    });
    pageB.on('dialog', async dialog => {
      console.log('--- Page B Alert Dialog Event ---');
      console.log('Message:', dialog.message());
      await dialog.dismiss();
    });

    // 2. Open AeroTalk Landing Page
    await pageA.goto('http://127.0.0.1:3000');
    await pageB.goto('http://127.0.0.1:3000');

    const uniqueId = Date.now();
    const usernameA = `UserA_${uniqueId}`;
    const usernameB = `UserB_${uniqueId}`;
    const emailA = `usera_${uniqueId}@test.com`;
    const emailB = `userb_${uniqueId}@test.com`;

    // 3. Register User A
    await pageA.click('#get-started-btn'); // Open Auth Screen
    await pageA.click('#show-register-btn'); // Toggle to register form
    await pageA.fill('#reg-username', usernameA);
    await pageA.fill('#reg-email', emailA);
    await pageA.fill('#reg-password', 'password123');
    await pageA.click('#register-form button[type="submit"]');

    // Wait for auth screen and landing screen to hide
    await expect(pageA.locator('#auth-screen')).toHaveClass(/hidden/);
    await expect(pageA.locator('#landing-screen')).toHaveClass(/hidden/);

    // 4. Register User B
    await pageB.click('#get-started-btn'); // Open Auth Screen
    await pageB.click('#show-register-btn'); // Toggle to register form
    await pageB.fill('#reg-username', usernameB);
    await pageB.fill('#reg-email', emailB);
    await pageB.fill('#reg-password', 'password123');
    await pageB.click('#register-form button[type="submit"]');

    await expect(pageB.locator('#auth-screen')).toHaveClass(/hidden/);
    await expect(pageB.locator('#landing-screen')).toHaveClass(/hidden/);

    // 5. Send Friend Request from User A to User B
    // Reload Page A so that it fetches the newly registered User B into its member list
    await pageA.reload();
    await expect(pageA.locator('#auth-screen')).toHaveClass(/hidden/);
    await expect(pageA.locator('#landing-screen')).toHaveClass(/hidden/);

    // Switch to Chat tab to see the Unified Members List
    await pageA.click('#mobile-nav-chats');
    await pageB.click('#mobile-nav-chats');

    // User A finds User B in directory list and clicks Add Friend
    const userBCard = pageA.locator('#friends-list li', { hasText: usernameB });
    await expect(userBCard).toBeVisible({ timeout: 15000 });
    
    const addFriendBtn = userBCard.locator('.add-friend-btn');
    await expect(addFriendBtn).toBeVisible();
    await addFriendBtn.click();

    // 6. User B Receives and Accepts Friend Request
    // Wait for the pending request count badge to appear on the Bell button (meaning websocket triggered updates)
    const reqBadge = pageB.locator('#pending-requests-count');
    await expect(reqBadge).toBeVisible();
    await expect(reqBadge).toHaveText('1');

    const bellBtn = pageB.locator('#show-pending-requests-btn');
    await expect(bellBtn).toBeVisible();
    await bellBtn.click({ force: true });

    // Explicitly wait for the modal to be visible and not hidden
    const modal = pageB.locator('#pending-requests-modal');
    await expect(modal).toBeVisible();
    await expect(modal).not.toHaveClass(/hidden/);

    // Accept request in the modal list
    const requestCard = pageB.locator('#modal-requests-list .request-card', { hasText: usernameA });
    await expect(requestCard).toBeVisible();
    
    const acceptBtn = requestCard.locator('.accept-friend-btn');
    await expect(acceptBtn).toBeVisible();
    await acceptBtn.click();

    // Verify modal closes
    await expect(pageB.locator('#pending-requests-modal')).toHaveClass(/hidden/);

    // 7. Verify friendship established and start chat window
    // Tapping on UserA in friends list on Page B should open active chat window
    const userACard = pageB.locator('#friends-list li', { hasText: usernameA });
    await expect(userACard).toBeVisible();
    await userACard.click();

    // User A clicks User B to open chat too
    await userBCard.click();

    // Verify active chat window is visible
    const chatTitleB = pageB.locator('.chat-header-title');
    await expect(chatTitleB).toContainText(usernameA);

    const chatTitleA = pageA.locator('.chat-header-title');
    await expect(chatTitleA).toContainText(usernameB);

    // 8. Real-time Messaging
    // User A sends message to User B
    await pageA.fill('#chat-input', `Hello ${usernameB}! Are you there?`);
    await pageA.click('#send-msg-btn');

    // User B receives the message
    const msgBubbleB = pageB.locator('.message-bubble', { hasText: `Hello ${usernameB}!` });
    await expect(msgBubbleB).toBeVisible();

    // User B replies to User A
    await pageB.fill('#chat-input', `Yes! Hello ${usernameA}, socket works!`);
    await pageB.click('#send-msg-btn');

    // User A receives the reply
    const msgBubbleA = pageA.locator('.message-bubble', { hasText: 'socket works!' });
    await expect(msgBubbleA).toBeVisible();

    // 9. Feed Post Interaction
    // Switch to Feed/Vibes tab on Page A
    await pageA.click('#mobile-nav-vibe');
    
    // Open Post Creation Modal
    await pageA.click('#open-feed-post-modal-btn'); // Trigger post create button
    await pageA.fill('#post-caption-input', `E2E Testing AeroTalk Feed features by ${usernameA}!`);
    await pageA.click('#create-post-submit');

    // Wait for modal to hide
    await expect(pageA.locator('#post-modal')).toHaveClass(/hidden/);

    // Switch to Vibes on Page B
    await pageB.click('#mobile-nav-vibe');

    // Wait for the new post to appear in Feed container
    const feedPost = pageB.locator('.post-card', { hasText: `E2E Testing AeroTalk Feed features by ${usernameA}!` }).first();
    await expect(feedPost).toBeVisible();

    // Like the post on Page B
    const likeBtn = feedPost.locator('.post-action-btn', { hasText: 'Like' });
    await expect(likeBtn).toBeVisible();
    await likeBtn.click();

    // Write a comment on Page B
    const commentInput = feedPost.locator('.comment-input-field');
    await expect(commentInput).toBeVisible();
    await commentInput.fill('Awesome post, works perfectly!');
    await commentInput.press('Enter');

    // Verify comment is published in the list
    const commentItem = feedPost.locator('.comment-item', { hasText: 'Awesome post' });
    await expect(commentItem).toBeVisible();

    // 10. Logout Flow
    // Switch to Profile Tab
    await pageA.click('#mobile-nav-profile');
    
    // Click Logout Button
    const logoutBtn = pageA.locator('#pane-logout-btn');
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.click();

    // Verify redirected back to Landing Login Screen
    await expect(pageA.locator('#landing-screen')).not.toHaveClass(/hidden/);
  });
});
