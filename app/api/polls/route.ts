import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

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
 * GET /api/polls
 * Fetch all polls created by the authenticated user.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { polls: [], error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Query only necessary fields
    const { data, error } = await supabase
      .from('polls')
      .select('id, question, options, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { polls: [], error: 'Failed to fetch polls.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ polls: data ?? [], error: null });
  } catch (error) {
    return NextResponse.json(
      { polls: [], error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/polls
 * Create a new poll for the authenticated user.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    const { question, options } = body;

    // Validate input
    if (!question || !Array.isArray(options) || options.length < 2) {
      return NextResponse.json(
        { error: 'Please provide a question and at least two options.' },
        { status: 400 }
      );
    }

    // Sanitize and validate question
    const sanitizedQuestion = question.trim();
    if (!isValidPollText(sanitizedQuestion)) {
      return NextResponse.json(
        { error: 'Invalid poll question.' },
        { status: 400 }
      );
    }

    // Sanitize and validate options
    const sanitizedOptions = options
      .map((opt: string) => opt.trim())
      .filter(Boolean);

    if (sanitizedOptions.length < 2) {
      return NextResponse.json(
        { error: 'Please provide at least two valid options.' },
        { status: 400 }
      );
    }

    for (const opt of sanitizedOptions) {
      if (!isValidPollText(opt)) {
        return NextResponse.json(
          { error: 'Invalid poll option.' },
          { status: 400 }
        );
      }
    }

    // Get user from session
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      return NextResponse.json(
        { error: 'Authentication failed.' },
        { status: 401 }
      );
    }

    if (!user) {
      return NextResponse.json(
        { error: 'You must be logged in to create a poll.' },
        { status: 401 }
      );
    }

    // Insert poll into database
    const { data, error } = await supabase
      .from('polls')
      .insert([
        {
          user_id: user.id,
          question: sanitizedQuestion,
          options: sanitizedOptions,
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Poll creation failed.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ poll: data, error: null }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

