const BACKEND_URL = 'http://localhost:3000';

async function run() {
  console.log('--- Creating a Comment for UI Verification ---');

  // 1. Login
  const loginRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'noor@example.com', password: 'Passw0rdOK' }), 
  });
  
  if (!loginRes.ok) {
    console.log('❌ Login failed. Check credentials.');
    return;
  }
  const cookies = loginRes.headers.get('set-cookie');
  console.log('✅ Logged in');

  // 2. Get a post
  const postsRes = await fetch(`${BACKEND_URL}/api/posts?page=1`);
  const posts = await postsRes.json();
  const postId = posts.data[0]._id;
  console.log(`✅ Testing on Post ID: ${postId}`);

  // 3. Post a comment
  const commentRes = await fetch(`${BACKEND_URL}/api/posts/${postId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookies },
    body: JSON.stringify({ text: "This is a test comment from the script to check the UI!" }),
  });
  
  if (!commentRes.ok) {
    console.log('❌ Failed to post comment:', await commentRes.text());
    return;
  }
  console.log('✅ Comment posted successfully! Go check your UI.');

  // 4. Fetch the post to verify the comment is there
  const updatedRes = await fetch(`${BACKEND_URL}/api/posts/${postId}`);
  const updatedPost = await updatedRes.json();
  
  console.log(`\nPost "${updatedPost.title}" has ${updatedPost.comments.length} comment(s).`);
  console.log('Comments:');
  updatedPost.comments.forEach(c => console.log(`- "${c.text}"`));
}

run().catch(console.error);