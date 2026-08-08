# Product Requirements Document (PRD): Artemis

## Overview

Artemis is an AI Interview Copilot designed for interviewers. It captures Google Meet audio, securely transcribes it using Deepgram, and evaluates the candidate's performance using Mistral LLM. The core product features a Chrome extension for in-call capture and a web dashboard for performance analytics.

## User Stories & Acceptance Criteria

### 1. Audio Capture (Chrome Extension)

**User Story:** As an interviewer, I want to capture my Google Meet call audio so that it can be transcribed automatically.
**Acceptance Criteria:**

- The extension adds a "Start Listening" button accessible from a popup.
- Audio is successfully captured from an active `meet.google.com` tab using Chrome TabCapture API.
- If invoked outside a Meet tab, it displays a clear error message: "Open a Google Meet tab and try again."

### 2. Live Transcription (Backend)

**User Story:** As an interviewer, I want the captured audio to be transcribed in real-time so that I don't lose context.
**Acceptance Criteria:**

- The backend accepts a WebSocket stream of raw 16kHz linear16 PCM audio.
- Audio chunks are sent to the Deepgram STT engine without dropped packets.
- The transcript reliably identifies the interviewer vs. the candidate.

### 3. Interview Evaluation (Dashboard)

**User Story:** As an interviewer, I want to see an automated evaluation of the candidate's performance after the interview.
**Acceptance Criteria:**

- Upon session completion, the full transcript is passed to Mistral for scoring.
- The evaluation returns a score (0-100) and structured feedback (Strengths, Weaknesses, Tips).
- The dashboard successfully fetches and visualizes this score via a Radar Chart.

### 4. Authentication

**User Story:** As an interviewer, I want to log in so my interviews are secure and accessible only to me.
**Acceptance Criteria:**

- Users can log in using Supabase (Email/Password or OAuth).
- The dashboard requires an active session to list interviews.
- The Chrome extension automatically syncs credentials to ensure sessions are linked to the correct user.
