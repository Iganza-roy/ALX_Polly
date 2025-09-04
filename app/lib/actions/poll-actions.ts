'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// Helper: sanitize and validate poll question/options
function isValidPollText(text: string): boolean {
  return (
    typeof text === 'string' &&
    text.length >= 2 &&
    text.length <= 200 &&
    !/<script.*?>/i.test(text)
  );
}

export async function createPoll(formData: FormData) {
  const supabase = await createClient();

  const question = (formData.get('question') as string)?.trim();
  const options = (formData.getAll('options') as string[])
    .map((opt) => opt.trim())
    .filter(Boolean);

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

// GET USER POLLS
export async function getUserPolls() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { polls: [], error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('polls')
    .select('id, question, options, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return { polls: [], error: 'Failed to fetch polls.' };
  return { polls: data ?? [], error: null };
}

// GET POLL BY ID
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

// SUBMIT VOTE
export async function submitVote(pollId: string, optionIndex: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Require login to vote
  if (!user) return { error: 'You must be logged in to vote.' };

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

// DELETE POLL
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

// UPDATE POLL
export async function updatePoll(pollId: string, formData: FormData) {
  const supabase = await createClient();

  const question = (formData.get('question') as string)?.trim();
  const options = (formData.getAll('options') as string[])
    .map((opt) => opt.trim())
    .filter(Boolean);

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
