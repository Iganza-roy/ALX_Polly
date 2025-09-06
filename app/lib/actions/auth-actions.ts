'use server';

import { createClient } from '@/lib/supabase/server';
import { LoginFormData, RegisterFormData } from '../types';

// Simple email validation
/**
 * Validate email format using a simple regex.
 * @param email - The email string to validate.
 * @returns True if valid, false otherwise.
 */
function isValidEmail(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

// Password strength: min 8 chars, at least 1 uppercase, 1 lowercase, 1 number, 1 special char
/**
 * Validate password strength.
 * Requirements: min 8 chars, at least 1 uppercase, 1 lowercase, 1 number, 1 special char.
 * @param password - The password string to validate.
 * @returns True if strong, false otherwise.
 */
function isStrongPassword(password: string): boolean {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/.test(
    password
  );
}

// Name validation: min 2 chars, no script tags
/**
 * Validate name for minimum length and prevent script injection.
 * @param name - The name string to validate.
 * @returns True if valid, false otherwise.
 */
function isValidName(name: string): boolean {
  return (
    typeof name === 'string' &&
    name.length >= 2 &&
    !/<script.*?>.*?<\/script>/i.test(name)
  );
}

/**
 * Authenticate a user with email and password.
 * Performs input validation and returns a generic error message on failure.
 * @param data - LoginFormData containing email and password.
 * @returns An object with an error message or null on success.
 */
export async function login(data: LoginFormData) {
  // Input validation
  if (!isValidEmail(data.email)) {
    return { error: 'Invalid email address.' };
  }
  if (!isStrongPassword(data.password)) {
    return { error: 'Password does not meet security requirements.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: data.email.trim(),
    password: data.password,
  });

  if (error) {
    // Log error.message internally if needed
    return { error: 'Authentication failed.' };
  }
  // Success: no error
  return { error: null };
}

/**
 * Register a new user with email, password, and name.
 * Performs input validation and returns a generic error message on failure.
 * @param data - RegisterFormData containing email, password, and name.
 * @returns An object with an error message or null on success.
 */
export async function register(data: RegisterFormData) {
  // Input validation
  if (!isValidEmail(data.email)) {
    return { error: 'Invalid email address.' };
  }
  if (!isStrongPassword(data.password)) {
    return { error: 'Password does not meet security requirements.' };
  }
  if (!isValidName(data.name)) {
    return { error: 'Invalid name.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: data.email.trim(),
    password: data.password,
    options: {
      data: {
        name: data.name.trim(),
      },
    },
  });

  if (error) {
    // Log error.message internally if needed
    return { error: 'Registration failed.' };
  }
  // Success: no error
  return { error: null };
}

/**
 * Log out the current user and clear session.
 * Returns a generic error message on failure.
 * @returns An object with an error message or null on success.
 */
export async function logout() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    // Log error.message internally if needed
    return { error: 'Logout failed.' };
  }
  // If using cookies, clear them here (not shown)
  return { error: null };
}

/**
 * Fetch the current authenticated user from Supabase.
 * Only returns safe user fields (id, email, name).
 * @returns An object with user id, email, and name, or null if not authenticated.
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  // Only return safe user fields
  if (!data.user) return null;
  const { id, email, user_metadata } = data.user;
  return { id, email, name: user_metadata?.name };
}

/**
 * Fetch the current session from Supabase.
 * Only returns session id and user id.
 * @returns An object with user_id and access_token, or null if no session.
 */
export async function getSession() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  // Only return session id and user id
  if (!data.session) return null;
  const { access_token, user } = data.session;
  return { user_id: user?.id, access_token };
}
