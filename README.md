# Quiztopia API

Region: eu-north-1
Stage: dev
Base URL:
https://cfw0tq99e4.execute-api.eu-north-1.amazonaws.com

## Arkitektur

API Gateway (HTTP API) → AWS Lambda (Node 20 + Middy) → DynamoDB
JWT-secret lagras i SSM Parameter Store (/quiztopia/dev/JWT_SECRET).
IAM-policy är definierad i serverless.yml (ingen separat roll), vilket uppfyller VG-kravet.

## Flöde

1. Användaren registrerar sig via signup
2. Loggar in och får en JWT-token
3. Skapar ett quiz
4. Lägger till frågor
5. Hämtar quiz och frågor
6. Tar bort quiz (endast sitt eget)
7. Registrerar poäng
8. Hämtar leaderboard

## Deploy

aws configure --profile quiztopia

aws ssm put-parameter \
 --name "/quiztopia/dev/JWT_SECRET" \
 --type SecureString \
 --value "<minst-32-tecken>" \
 --overwrite \
 --region eu-north-1 \
 --profile quiztopia

npx serverless deploy

## Endpoints

Auth header: Authorization: Bearer <token>

## Autentisering

POST /auth/signup → { email, password }
POST /auth/login → { email, password } → { token }

## Quiz

GET /quizzes → Lista alla quiz
GET /quizzes/{quizId} → Hämtar quiz och dess frågor
POST /quizzes (Bearer) → { name }
DELETE /quizzes/{quizId} (Bearer) → Tar bort quiz

## Frågor

POST /quizzes/{quizId}/questions (Bearer) → { question, answer, lat?, lng? }

## Poäng och leaderboard

POST /quizzes/{quizId}/scores (Bearer) → { score: number }

GET /quizzes/{quizId}/leaderboard?limit=10 → Top N för ett quiz

GET /quizzes/leaderboard?all=true&limit=10 → Top N per quiz (alla quiz)

## Hälsa

GET / eller /health → { ok: true, service, time }

## Datamodell (DynamoDB)

# Users

PK: userId
GSI: EmailIndex(email)

# Quizzes

PK: quizId
Fält: ownerId, name, createdAt

# Questions

PK: quizId
SK: questionId

# Scores

PK: quizId
SK: scoreSort (999999 - score)
GSI: ScoresByQuiz(quizId, scoreSort)

## Postman

# Importera:

postman_collection.json
postman_environment.json

# Körordning:

Login → sätter {{token}}
Create quiz → sätter {{quizId}}
Kör övriga requests (frågor, poäng, leaderboard)

## Loggar och felsökning

npx serverless logs -f <funktion> -t
