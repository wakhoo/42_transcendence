import { NestFactory, Reflector } from "@nestjs/core";
import { ClassSerializerInterceptor, ValidationPipe } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { loadVaultSecrets } from "./vault-loader";
import { QueryFailedFilter } from "./common/filters/query-failed.filter";

async function bootstrap() {
  await loadVaultSecrets();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.set("trust proxy", 1);
  app.setGlobalPrefix("api");

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.useGlobalFilters(new QueryFailedFilter());

  if (process.env.NODE_ENV !== "production") {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("Transcendence API")
      .setDescription("REST API for auth, user, and chat")
      .setVersion("1.0")
      .addBearerAuth()
      .build();
    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("api/docs", app, swaggerDocument);
    console.log(`Swagger docs at http://0.0.0.0:3000/api/docs`);
  }

  await app.listen(3000, "0.0.0.0");
  console.log(`Backend up on http://0.0.0.0:3000/api`);

  process.on("SIGTERM", async () => {
    await app.close();
    process.exit(0);
  });
}
void bootstrap();
