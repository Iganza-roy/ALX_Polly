'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

/**
 * Validate poll question and options for length and XSS prevention.
 * @param text - The text to validate.
 * @returns True if valid, false otherwise.
 */
function isValidPollText(text: string): boolean {
  return (
    typeof text === 'string' &&
    text.length >= 2 &&
    text.length <= 200 &&
    !/<script.*?>/i.test(text)
  );
}

/**
 * Create a new poll for the authenticated user.
 * Validates and sanitizes input, checks authentication, and inserts poll.
 * @param formData - FormData containing question and options.
 * @returns An object with an error message or null on success.
 */
export async function createPoll(formData: FormData) {
  const supabase = await createClient();

  // Extract and sanitize question and options
  const question = (formData.get('question') as string)?.trim();
  const options = (formData.getAll('options') as string[])
    .map((opt) => opt.trim())
    .filter(Boolean);

  // Validate input
  if (!question || options.length < 2) {
    return { error: 'Please provide a question and at least two options.' };
  }
  if (!isValidPollText(question)) {
    return { error: 'Invalid poll question.' };
  }
  for (const opt of options) {
    if (!isValidPollText(opt)) {
      return { error: 'Invalid poll option.' };
    }
  }

  // Get user from session
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) {
    // Log userError.message internally
    return { error: 'Authentication failed.' };
  }
  if (!user) {
    return { error: 'You must be logged in to create a poll.' };
  }

  // Insert poll into database
  const { error } = await supabase.from('polls').insert([
    {
      user_id: user.id,
      question,
      options,
    },
  ]);

  if (error) {
    // Log error.message internally
    return { error: 'Poll creation failed.' };
  }

  revalidatePath('/polls');
  return { error: null };
}

/**
 * Fetch all polls created by the authenticated user.
 * Only returns necessary fields.
 * @returns An object with polls array and error message if any.
 */
export async function getUserPolls() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { polls: [], error: 'Not authenticated' };

  // Query only necessary fields
  const { data, error } = await supabase
    .from('polls')
    .select('id, question, options, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return { polls: [], error: 'Failed to fetch polls.' };
  return { polls: data ?? [], error: null };
}

/**
 * Fetch a poll by its ID.
 * Only returns necessary fields.
 * @param id - Poll ID.
 * @returns An object with poll data and error message if any.
 */
export async function getPollById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('polls')
    .select('id, question, options, created_at')
    .eq('id', id)
    .single();

  if (error) return { poll: null, error: 'Poll not found.' };
  return { poll: data, error: null };
}

/**
 * Submit a vote for a poll option. Requires authentication.
 * @param pollId - Poll ID.
 * @param optionIndex - Index of the selected option.
 * @returns An object with error message or null on success.
 */
export async function submitVote(pollId: string, optionIndex: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Require login to vote
  if (!user) return { error: 'You must be logged in to vote.' };

  // Insert vote into database
  const { error } = await supabase.from('votes').insert([
    {
      poll_id: pollId,
      user_id: user.id,
      option_index: optionIndex,
    },
  ]);

  if (error) return { error: 'Vote submission failed.' };
  return { error: null };
}

/**
 * Delete a poll by ID. Only allows deletion by the poll owner.
 * @param id - Poll ID.
 * @returns An object with error message or null on success.
 */
export async function deletePoll(id: string) {
  const supabase = await createClient();
  // Get user from session
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) {
    return { error: 'Authentication failed.' };
  }
  if (!user) {
    return { error: 'You must be logged in to delete a poll.' };
  }
  // Only allow deleting polls owned by the user
  const { error } = await supabase
    .from('polls')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) return { error: 'Poll deletion failed.' };
  revalidatePath('/polls');
  return { error: null };
}

/**
 * Update a poll's question and options. Only allows update by the poll owner.
 * Validates and sanitizes input.
 * @param pollId - Poll ID.
 * @param formData - FormData containing question and options.
 * @returns An object with error message or null on success.
 */
export async function updatePoll(pollId: string, formData: FormData) {
  const supabase = await createClient();

  // Extract and sanitize question and options
  const question = (formData.get('question') as string)?.trim();
  const options = (formData.getAll('options') as string[])
    .map((opt) => opt.trim())
    .filter(Boolean);

  // Validate input
  if (!question || options.length < 2) {
    return { error: 'Please provide a question and at least two options.' };
  }
  if (!isValidPollText(question)) {
    return { error: 'Invalid poll question.' };
  }
  for (const opt of options) {
    if (!isValidPollText(opt)) {
      return { error: 'Invalid poll option.' };
    }
  }

  // Get user from session
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) {
    return { error: 'Authentication failed.' };
  }
  if (!user) {
    return { error: 'You must be logged in to update a poll.' };
  }

  // Only allow updating polls owned by the user
  const { error } = await supabase
    .from('polls')
    .update({ question, options })
    .eq('id', pollId)
    .eq('user_id', user.id);

  if (error) {
    return { error: 'Poll update failed.' };
  }

  return { error: null };
}
