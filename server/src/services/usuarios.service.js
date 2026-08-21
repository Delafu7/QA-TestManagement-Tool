const usuariosModel = require('../models/usuarios.model');
const { conflict, notFound } = require('../utils/errors');

const list = (query) => usuariosModel.list(query);

const getById = (id) => {
  const usuario = usuariosModel.findById(id);
  if (!usuario) throw notFound('Usuario');
  return usuario;
};

const create = ({ nombre, email, rol, avatarUrl }) => {
  if (usuariosModel.findByEmail(email)) {
    throw conflict('EMAIL_YA_EXISTE', `Ya existe un usuario con el email ${email}`);
  }
  return usuariosModel.create({ nombre, email, rol, avatarUrl });
};

const update = (id, fields) => {
  const usuario = usuariosModel.update(id, fields);
  if (!usuario) throw notFound('Usuario');
  return usuario;
};

module.exports = { list, getById, create, update };
