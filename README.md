# Quiztopia API

Region: eu-north-1 • Stage: dev • Base URL: https://cfw0tq99e4.execute-api.eu-north-1.amazonaws.com

## Arkitektur

API Gateway (HTTP API) → AWS Lambda (Node 20 + Middy) → DynamoDB
JWT-secret via SSM Parameter Store (/quiztopia/dev/JWT_SECRET)

## Deploy

aws configure --profile quiztopia
aws ssm put-parameter --name "/quiztopia/dev/JWT_SECRET" --type SecureString --value "<minst-32-tecken>" --overwrite --region eu-north-1 --profile quiztopia
npx serverless deploy

## Endpoints

POST /auth/signup {email,password}
POST /auth/login {email,password} -> {token}
GET /quizzes
GET /quizzes/{quizId}
POST /quizzes (Bearer) {name}
DELETE /quizzes/{quizId} (Bearer)
POST /quizzes/{quizId}/questions (Bearer) {question,answer,lat?,lng?}
POST /quizzes/{quizId}/scores (Bearer) {score:number}
GET /quizzes/{quizId}/leaderboard?limit=10

## Postman

Importera `postman_environment.json` och `postman_collection.json`.

1. Kör **Login** → sätter {{token}}. 2) Kör **Create quiz** → sätter {{quizId}}. 3) Kör övriga.

## Datamodell (DynamoDB)

Users(userId PK) + GSI EmailIndex(email)  
Quizzes(quizId PK, ownerId)  
Questions(PK quizId, SK questionId)  
Scores(PK quizId, SK scoreSort) + GSI ScoresByQuiz(quizId, scoreSort)

## Loggar & felsök

npx serverless logs -f <funktion> -t
