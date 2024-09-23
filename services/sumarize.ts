import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

export async function summarizePost(post: any) {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    });

    const prompt = `This is a WordPress post. Summarize the post information in one paragraph, including details like title, author, date, and a brief description of the content.
      Post information:
      ${JSON.stringify(post, null, 2)}
      Post content: 
      ${post.post_content}
    `;

    const response: any = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
    });

    return response.choices[0]?.message?.content;
  } catch (err) {
    console.error('Error summarizing post:', err);
    return ""; // Handle summarization error (e.g., return empty summary)
  }
}

export async function summarizeBlog(blog: any) {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    });

    const prompt = `This is a WordPress blog. Summarize the blog information in one paragraph, including details like title, author, date, and a brief description of the content.
      Blog information:
      ${JSON.stringify(blog, null, 2)}
      Blog content: 
      ${blog.post_content}
    `;

    const response: any = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
    });

    return response.choices[0]?.message?.content;
  } catch (err) {
    console.error('Error summarizing blog:', err);
    return ""; // Handle summarization error (e.g., return empty summary)
  }
}

