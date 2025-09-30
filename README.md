### Backend Fördjupnign - Individuell Examamination

# Quiztopia API

Region: eu-north-1 · Stage: dev · Base URL: https://cfw0tq99e4.execute-api.eu-north-1.amazonaws.com

## Auth

POST /auth/signup {email,password}
POST /auth/login {email,password} -> {token}

## Quizzes

GET /quizzes
GET /quizzes/{quizId}
POST /quizzes (Bearer) {name}
DELETE /quizzes/{quizId} (Bearer)

## Questions

POST /quizzes/{quizId}/questions (Bearer) {question,answer,lat?,lng?}

## Scores

POST /quizzes/{quizId}/scores (Bearer) {score:number}
GET /quizzes/{quizId}/leaderboard?limit=10
