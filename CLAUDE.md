# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Angular 18 TypeScript frontend application serving as the interface for yukam-drighi microservices. Currently in MVP phase with simple HTTP communication.

## Core Features

The application provides customer (client) management functionality:
- List all customers
- Search customer by CPF/CNPJ (returns UUID only)
- Get customer details by UUID (complete information)
- Edit customer information:
  - Address (Endereço)
  - Contact details (Contato)
  - Documents (Documentos)
- Basic authentication:
  - Username/password login
  - Password recovery flow

## Architecture Notes

**Communication Pattern**: Simple HTTP requests to yukam-drighi microservices backend. This is an MVP implementation - consider more sophisticated patterns (state management, error handling, caching) as the application grows.

**Authentication**: Basic username/password authentication is implemented. Ensure JWT tokens or session management is properly handled for secure communication with backend services.

**Customer Data Flow**:
- Search operations (CPF/CNPJ) return minimal data (UUID only)
- Full customer details require UUID-based lookup
- This two-step pattern may impact UX - consider combining where appropriate

## Development Commands

Once Angular project is initialized, standard commands will be:
- `npm install` - Install dependencies
- `ng serve` or `npm start` - Run development server
- `ng build` - Build for production
- `ng test` - Run unit tests
- `ng lint` - Lint the codebase

## Angular 18 Specifics

When implementing features:
- Use standalone components (Angular 18 default)
- Leverage signals for reactive state management
- Consider using `@defer` for lazy loading components
- Use `inject()` function for dependency injection in components
- Implement proper TypeScript types for all API responses from yukam-drighi services
