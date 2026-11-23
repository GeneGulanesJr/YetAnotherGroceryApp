import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useAuth, useClerk, useSignIn, useSignUp, useUser } from "@clerk/expo";

import { ScreenContainer } from "../components/ScreenContainer";
import { AppTextInput, Chip, Field, Notice, PrimaryButton, Text } from "../components/ui";

/**
 * Account screen: email + password sign-in/sign-up against Clerk, plus the
 * signed-in view (email + sign out). Sign-up confirms with the emailed code.
 * Uses Clerk v6 "future" custom-flow APIs (signIn.password,
 * signUp.password, signUp.verifications.*), which return `{ error }` instead
 * of throwing. Once a session exists, `SyncAuthBridge` hands the session JWT
 * to the sync transport automatically.
 */

type Mode = "sign-in" | "sign-up";

interface ClerkErrorLike {
  message?: string;
}

interface ClerkHookErrors {
  fields?: object | null;
  global?: { message?: string; longMessage?: string }[] | null;
}

function errorText(error: ClerkErrorLike | null, errors?: ClerkHookErrors): string {
  const fields = errors?.fields as
    | Record<string, { message?: string; longMessage?: string } | null>
    | undefined;
  const fieldError = fields === undefined ? null : (Object.values(fields).find((field) => field !== null) ?? null);
  return (
    errors?.global?.[0]?.longMessage ??
    errors?.global?.[0]?.message ??
    fieldError?.longMessage ??
    fieldError?.message ??
    error?.message ??
    "Authentication failed. Check your details and try again."
  );
}

export function AuthScreen() {
  const { isLoaded, isSignedIn } = useAuth();
  return (
    <ScreenContainer>
      <ScrollView contentContainerClassName="px-5 pb-8 pt-4" keyboardShouldPersistTaps="handled">
        <Text tone="secondary">
          Optional. An account syncs your library and prices between devices; everything works
          offline without one.
        </Text>
        {!isLoaded ? (
          <Text tone="meta" className="mt-4">
            Loading…
          </Text>
        ) : isSignedIn ? (
          <SignedInView />
        ) : (
          <SignedOutView />
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

function SignedInView() {
  const { user } = useUser();
  const { signOut } = useClerk();
  return (
    <View className="mt-6">
      <Text variant="label" tone="secondary">
        Signed in as
      </Text>
      <Text variant="title" className="mt-1">
        {user?.primaryEmailAddress?.emailAddress ?? "unknown"}
      </Text>
      <View className="mt-6">
        <PrimaryButton label="Sign out" variant="secondary" icon="log-out-outline" onPress={() => void signOut()} />
      </View>
    </View>
  );
}

function SignedOutView() {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { isLoaded } = useAuth();
  const { signIn } = useSignIn();
  const { signUp, errors: signUpErrors } = useSignUp();
  const { setActive } = useClerk();

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mode === "sign-in") {
        const { error: passwordError } = await signIn.password({
          identifier: email.trim(),
          password,
        });
        if (passwordError !== null) {
          setError(passwordError.message);
          return;
        }
        if (signIn.createdSessionId !== null) {
          await setActive({ session: signIn.createdSessionId });
        }
      } else if (!pendingVerification) {
        const { error: createError } = await signUp.password({
          emailAddress: email.trim(),
          password,
        });
        if (createError !== null) {
          setError(errorText(createError, signUpErrors));
          return;
        }
        // A fresh password sign-up needs its email address verified before
        // the session activates; ask Clerk to send the code now.
        const { error: sendError } = await signUp.verifications.sendEmailCode();
        if (sendError !== null) {
          setError(errorText(sendError, signUpErrors));
        }
        setPendingVerification(true);
      } else {
        const { error: verifyError } = await signUp.verifications.verifyEmailCode({
          code: code.trim(),
        });
        if (verifyError !== null) {
          setError(errorText(verifyError, signUpErrors));
          return;
        }
        if (signUp.createdSessionId !== null) {
          await setActive({ session: signUp.createdSessionId });
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const canSubmit =
    isLoaded &&
    !busy &&
    email.includes("@") &&
    password.length >= 8 &&
    (!pendingVerification || code.trim().length > 0);

  return (
    <View className="mt-6">
      <View className="mb-5 flex-row">
        {(["sign-in", "sign-up"] as const).map((value) => (
          <Chip
            key={value}
            label={value === "sign-in" ? "Sign in" : "Sign up"}
            selected={mode === value}
            onPress={() => {
              setMode(value);
              setPendingVerification(false);
              setError(null);
            }}
          />
        ))}
      </View>

      <Field label="Email">
        <AppTextInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
        />
      </Field>

      <Field label="Password">
        <AppTextInput
          autoCapitalize="none"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholder="At least 8 characters"
        />
      </Field>

      {mode === "sign-up" && pendingVerification ? (
        <Field label="Verification code">
          <AppTextInput
            autoCapitalize="none"
            keyboardType="number-pad"
            value={code}
            onChangeText={setCode}
            placeholder="Check your email"
          />
        </Field>
      ) : null}

      {error !== null ? <Notice>{error}</Notice> : null}

      <View className="mt-6">
        <PrimaryButton
          label={
            mode === "sign-in"
              ? "Sign in"
              : pendingVerification
                ? "Verify email"
                : "Create account"
          }
          onPress={() => void submit()}
          disabled={!canSubmit}
          loading={busy}
        />
      </View>
    </View>
  );
}
