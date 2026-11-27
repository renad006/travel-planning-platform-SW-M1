const BACKEND_URL = 'http://localhost:3000';

async function run() {
  console.log('--- Testing Comment Logic ---');

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
    body: JSON.stringify({ text: "This is a test comment from the script!" }),
  });
  
  if (!commentRes.ok) {
    console.log('❌ Failed to post comment:', await commentRes.text());
    return;
  }
  const newComment = await commentRes.json();
  console.log('✅ Comment posted successfully:', newComment.text);

  // 4. Edit the comment
  const editRes = await fetch(`${BACKEND_URL}/api/comments/${newComment._id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: cookies },
    body: JSON.stringify({ text: "This is the EDITED comment!" }),
  });
  
  if (editRes.ok) {
    console.log('✅ Comment edited successfully');
  } else {
    console.log('❌ Failed to edit comment');
  }

  // 5. Delete the comment
  const deleteRes = await fetch(`${BACKEND_URL}/api/comments/${newComment._id}`, {
    method: 'DELETE',
    headers: { Cookie: cookies },
  });
  
  if (deleteRes.ok) {
    console.log('✅ Comment deleted successfully');
  } else {
    console.log('❌ Failed to delete comment');
  }
}

run().catch(console.error);