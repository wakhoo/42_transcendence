import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api");

  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  await app.listen(3000, "0.0.0.0");
  console.log(`Backend up on http://0.0.0.0:3000/api`);
}
void bootstrap();
